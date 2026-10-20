"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  FileText,
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  Sparkles,
  SpellCheck,
  Undo2,
  X,
} from "lucide-react";
import { applyJournalSuggestion, journalChanges } from "@/lib/journal-revision";
import { JournalLibrary } from "./journal-library";
import { journalPages, journalPageTitle, journalDraftKey as key, type JournalDraft as Draft } from "@/lib/journal-library";
import { journalSelectionPosition, placeJournalToolbar } from "@/lib/journal-selection";
import type { JournalPrompt } from "@/lib/private-types";
import { lessons } from "@/lib/daily-program";
import { reflectionInEntry } from "@/lib/program-journal";
import type { JournalEntry } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { localToday } from "@/lib/units";
export function JournalEditor({
  entries,
  locale,
  onSave,
  prompt,
  encrypted = false,
  onProgram,
  navigation,
  active = true,
}: {
  entries: JournalEntry[];
  navigation?: { id: number; date?: string };
  active?: boolean;
  locale: Locale;
  prompt?: JournalPrompt | null;
  encrypted?: boolean;
  onProgram?: () => void;
  onSave: (data: {
    date: string;
    text: string;
    title: string;
    mood: number;
    expectedRevision: number;
  }) => Promise<JournalEntry>;
}) {
  const [screen, setScreen] = useState<"library" | "editor">("library");
  const [openDates, setOpenDates] = useState<string[]>([]);
  const pageRoot = useRef<HTMLElement>(null);
  const [date, setDate] = useState(localToday);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const editor = useRef<HTMLTextAreaElement>(null);
  const titleEditor = useRef<HTMLTextAreaElement>(null);
  const selectionTools = useRef<HTMLDivElement>(null);
  const aiRequest = useRef<AbortController | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; visible: boolean }>({ left: 0, top: 0, visible: false });
  const [previewResult, setPreviewResult] = useState(false);
  const [protectionChanged, setProtectionChanged] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [proposal, setProposal] = useState<{
    text: string;
    original: string;
    start: number;
    end: number;
    date: string;
  } | null>(null);
  const [undo, setUndo] = useState<{
    before: string;
    after: string;
    date: string;
  } | null>(null);
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const entry = entries.find((e) => e.date === date);
  const initial = {
    text: entry?.text || "",
    title: entry?.title || "",
    mood: entry?.mood || 3,
    revision: entry?.revision || 0,
  };
  const draft = drafts[date] || { ...initial, baseline: key(initial) };
  function change(patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [date]: { ...draft, ...patch } }));
    setStatus("");
  }
  const aiDisabled = encrypted || protectionChanged;
  function captureSelection() {
    const el = editor.current;
    if (el) setSelection({ start: el.selectionStart, end: el.selectionEnd });
  }
  function openPage(nextDate: string) {
    setDate(nextDate);
    setScreen("editor");
    setOpenDates(current => current.includes(nextDate) ? current : [...current, nextDate]);
    setSelection({ start: 0, end: 0 });
    setError("");
    setStatus("");
    requestAnimationFrame(() => {
      pageRoot.current?.scrollIntoView({ block: "start" });
      titleEditor.current?.focus({ preventScroll: true });
    });
  }
  useEffect(() => {
    cancelAi();
    setProposal(null);
    setSelection({ start: 0, end: 0 });
    if (navigation?.date) openPage(navigation.date);
    else setScreen("library");
  }, [navigation]);
  useEffect(() => {
    if (!active) {
      cancelAi();
      setSelection({ start: 0, end: 0 });
    }
  }, [active]);
  useLayoutEffect(() => {
    if (!active || screen !== "editor" || selection.start === selection.end || aiDisabled || aiBusy || proposal) return;
    const position = () => {
      const el = editor.current, toolbar = selectionTools.current;
      if (!el || !toolbar) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const tabs = pageRoot.current?.querySelector(".journal-tabs")?.getBoundingClientRect();
      const safeTop = tabs && tabs.top <= viewportTop + 1 ? Math.max(viewportTop, tabs.bottom) : viewportTop;
      const bounds = { left: viewport?.offsetLeft || 0, top: safeTop, width: viewport?.width || window.innerWidth, height: (viewport?.height || window.innerHeight) - (safeTop - viewportTop) };
      const rects = journalSelectionPosition(el, selection.start, selection.end);
      const size = toolbar.getBoundingClientRect();
      setAnchor(placeJournalToolbar(rects, { width: size.width, height: size.height }, bounds));
    };
    position();
    const observer = new ResizeObserver(position);
    if (selectionTools.current) observer.observe(selectionTools.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [selection, active, screen, aiDisabled, aiBusy, proposal, date, locale]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!editor.current?.contains(event.target as Node) && !selectionTools.current?.contains(event.target as Node)) setSelection({ start: 0, end: 0 });
    };
    const sync = () => { if (document.activeElement === editor.current) captureSelection(); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("selectionchange", sync);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("selectionchange", sync);
    };
  }, []);
  function cancelAi() {
    aiRequest.current?.abort();
    aiRequest.current = null;
    setAiBusy(false);
  }
  useEffect(
    () => () => {
      aiRequest.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!aiDisabled) return;
    cancelAi();
    setProposal(null);
    setSelection({ start: 0, end: 0 });
  }, [aiDisabled]);
  const consumed = useRef(new Set<string>());
  useEffect(() => {
    if (!prompt || consumed.current.has(prompt.id)) return;
    consumed.current.add(prompt.id);
    const target = prompt.date || localToday();
    const saved = entries.find((e) => e.date === target);
    setDrafts((current) => {
      const initial = {
        text: saved?.text || "",
        title: saved?.title || "",
        mood: saved?.mood || 3,
        revision: saved?.revision || 0,
      };
      const previous = current[target] || {
        ...initial,
        baseline: key(initial),
      };
      const lesson = lessons.find((l) => l.id === prompt.lessonId);
      const exists = lesson
        ? reflectionInEntry(lesson, previous) !== null || !!prompt.date
        : previous.text.includes(prompt.question);
      const addition = `${prompt.title}\n${prompt.question}\n\n`;
      const text = exists ? previous.text : previous.text ? `${previous.text}\n\n${addition}` : addition;
      if (text.length > 20000) {
        setError(
          t(
            "Cette page est pleine. Créez une nouvelle page avant d’ajouter cette réflexion.",
            "This page is full. Open a new page before adding this reflection.",
          ),
        );
        return current;
      }
      return {
        ...current,
        [target]: { ...previous, title: previous.title || prompt.title, text },
      };
    });
    openPage(target);
    requestAnimationFrame(() => {
      editor.current?.focus();
      const length = editor.current?.value.length || 0;
      editor.current?.setSelectionRange(length, length);
    });
  }, [prompt]);
  useEffect(() => {
    const fields = [editor.current, titleEditor.current].filter(
      (field): field is HTMLTextAreaElement => !!field,
    );
    const widths = new Map<HTMLTextAreaElement, number>();
    const resize = (field: HTMLTextAreaElement) => {
      // Dashboard panels mount while hidden. Measure only after they become visible.
      if (!field.clientWidth) return;
      field.style.height = "auto";
      field.style.height = `${Math.max(field === editor.current ? 340 : 0, field.scrollHeight)}px`;
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const field = entry.target as HTMLTextAreaElement;
        const width = field.clientWidth;
        if (width !== widths.get(field)) {
          widths.set(field, width);
          resize(field);
        }
      }
    });
    for (const field of fields) {
      resize(field);
      observer.observe(field);
    }
    return () => observer.disconnect();
  }, [draft.text, draft.title, date, proposal, locale, screen, active]);
  const dirty = Object.values(drafts).some((d) => key(d) !== d.baseline);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  async function save() {
    setBusy(true);
    setError("");
    const savedDate = date;
    try {
      const result = await onSave({
        date,
        text: draft.text,
        title: draft.title,
        mood: draft.mood,
        expectedRevision: draft.revision,
      });
      const next = {
        text: result.text,
        title: result.title || "",
        mood: result.mood,
        revision: result.revision || 1,
      };
      setDrafts((current) => ({
        ...current,
        [savedDate]: { ...next, baseline: key(next) },
      }));
      setStatus(t("Votre page est enregistrée.", "Your page is saved."));
    } catch (e) {
      setError(
        e instanceof Error && e.message === "conflict"
          ? t(
              "Cette page a été modifiée dans un autre onglet. Votre brouillon est conservé ici. Copiez-le avant de recharger pour comparer les versions.",
              "This page changed in another tab. Your draft is preserved here. Copy it before reloading to compare versions.",
            )
          : t(
              "L’enregistrement n’a pas été confirmé. Votre texte est conservé ici.",
              "Saving could not be confirmed. Your text is still here.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function edit(action: "improve" | "correct") {
    if (aiDisabled || aiBusy || busy) return;
    const { start, end } = selection;
    const original = draft.text;
    const text = original.slice(start, end);
    if (!text.trim() || text.length > 8000) return;
    setError("");
    setProposal(null);
    setAiBusy(true);
    const controller = new AbortController();
    aiRequest.current = controller;
    setPreviewResult(false);
    try {
      const response = await fetch("/api/journal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (typeof result.text !== "string" || !result.text.trim())
        throw Error("invalid");
      const next = { text: result.text, original, start, end, date };
      applyJournalSuggestion(original, next);
      if (result.text === text)
        setStatus(
          t(
            "Ce passage ne nécessite aucune correction.",
            "This passage needs no changes.",
          ),
        );
      else setProposal(next);
      setSelection({ start: 0, end: 0 });
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.message === "409") setProtectionChanged(true);
      setError(
        e instanceof Error && e.message === "429"
          ? t(
              "La limite de 20 propositions par heure est atteinte. Réessayez plus tard.",
              "The limit of 20 suggestions per hour has been reached. Please try later.",
            )
          : e instanceof Error && e.message === "409"
            ? t(
                "La protection renforcée est active. Rechargez votre espace pour continuer.",
                "Enhanced protection is active. Reload your workspace to continue.",
              )
            : e instanceof Error && e.message === "too_long"
              ? t(
                  "Cette proposition dépasse la longueur de la page. Sélectionnez un passage plus court.",
                  "This suggestion would exceed the page limit. Select a shorter passage.",
                )
              : t(
                  "L’IA n’est pas disponible pour le moment. Votre texte n’a pas changé.",
                  "AI is currently unavailable. Your text has not changed.",
                ),
      );
    } finally {
      if (aiRequest.current === controller) {
        aiRequest.current = null;
        setAiBusy(false);
      }
    }
  }
  const currentProposal = proposal?.date === date ? proposal : null;
  const stale = !!currentProposal && currentProposal.original !== draft.text;
  const highlighted = draft.text.slice(selection.start, selection.end);
  function finishSuggestion(accept: boolean) {
    if (!currentProposal) return;
    if (accept) {
      try {
        const after = applyJournalSuggestion(draft.text, currentProposal);
        setUndo({ before: draft.text, after, date });
        change({ text: after });
      } catch {
        setError(
          t(
            "Le texte a changé. Relancez la proposition.",
            "The text changed. Request a new suggestion.",
          ),
        );
        return;
      }
    }
    const caret =
      currentProposal.start +
      (accept
        ? currentProposal.text.length
        : currentProposal.end - currentProposal.start);
    setProposal(null);
    setSelection({ start: 0, end: 0 });
    requestAnimationFrame(() => {
      editor.current?.focus({ preventScroll: true });
      editor.current?.setSelectionRange(caret, caret);
    });
  }
  const pages = journalPages(entries, drafts);
  const titleFor = (pageDate: string) => journalPageTitle(pages.find(page => page.date === pageDate), t("Sans titre", "Untitled"));
  const locked = busy || aiBusy || !!proposal;
  return (
    <section className={`journal-page journal-${screen}`} ref={pageRoot}>
      {(screen === "editor" || openDates.length > 0) && <nav className="journal-tabs" aria-label={t("Pages du journal", "Journal pages")}>
        <button className="journal-home-tab" aria-current={screen === "library" ? "page" : undefined} disabled={locked} onClick={() => setScreen("library")}><BookOpen size={15}/>{t("Toutes mes pages", "All my pages")}</button>
        <div className="journal-open-tabs">
          {openDates.map(pageDate => <div className="journal-tab" key={pageDate} data-selected={screen === "editor" && date === pageDate}>
            <button aria-current={screen === "editor" && date === pageDate ? "page" : undefined} disabled={locked} onClick={() => openPage(pageDate)} title={`${pageDate} · ${titleFor(pageDate)}`}><FileText size={14}/><span>{titleFor(pageDate)}</span>{pages.find(page => page.date === pageDate)?.dirty && <i aria-label={t("Non enregistré", "Unsaved")}/>}</button>
            <button className="journal-close-tab" disabled={locked} aria-label={`${t("Fermer l’onglet", "Close tab")} ${titleFor(pageDate)}`} onClick={() => {
              const remaining = openDates.filter(value => value !== pageDate);
              setOpenDates(remaining);
              if (screen === "editor" && date === pageDate) {
                if (remaining.length) openPage(remaining.at(-1)!);
                else setScreen("library");
              }
            }}><X size={12}/></button>
          </div>)}
        </div>
        <button className="journal-new-tab" disabled={locked} aria-label={t("Écrire aujourd’hui", "Write today")} title={t("Écrire aujourd’hui", "Write today")} onClick={() => openPage(localToday())}><Plus size={17}/></button>
      </nav>}
      {screen === "library" ? <JournalLibrary pages={pages} locale={locale} onOpen={openPage}/> : <>
      <div className="journal-page-nav">
        <form className="journal-date-form" onSubmit={event => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("journal-date");
          if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) openPage(value);
        }}>
          <label>{t("Aller au", "Go to")}
            <input key={date} name="journal-date" type="date" required aria-label={t("Date du journal", "Journal date")} defaultValue={date} disabled={locked}/>
          </label>
          <button type="submit" className="journal-open-date" disabled={locked} aria-label={t("Ouvrir cette date", "Open this date")} title={t("Ouvrir cette date", "Open this date")}><ArrowRight size={15}/></button>
        </form>
        <div className="journal-page-actions">
          <span className="journal-save-indicator">{key(draft) === draft.baseline ? t("À jour", "Up to date") : t("Brouillon", "Draft")}</span>
          <button className="primary" disabled={locked || !draft.text.trim()} onClick={() => void save()}>{busy ? t("Enregistrement…", "Saving…") : t("Enregistrer", "Save")}</button>
        </div>
      </div>
      <div className="journal-paper">
        {prompt?.lessonId && onProgram && (draft.text.includes(prompt.question) || prompt.date === date) && (
          <button className="journal-program-back text-button" onClick={onProgram} disabled={busy}>
            <ArrowLeft size={13} /> {t("Mon programme", "My program")}
          </button>
        )}
        <textarea
          ref={titleEditor}
          rows={1}
          className="journal-title"
          aria-label={t("Titre de la page", "Page title")}
          placeholder={t("Une nouvelle page", "A new page")}
          maxLength={160}
          value={draft.title}
          onChange={(e) => change({ title: e.target.value })}
          disabled={busy || aiBusy || !!proposal}
        />
        <div className="journal-properties">
          <span>
            {new Date(`${date}T12:00:00Z`).toLocaleDateString(
              locale === "fr" ? "fr-CA" : "en-CA",
              {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              },
            )}
          </span>
          <span className="journal-mood">
            {t("Mon humeur", "My mood")}
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                className={draft.mood === m ? "selected" : ""}
                onClick={() => change({ mood: m })}
                disabled={busy || aiBusy || !!proposal}
                aria-label={`${t("Humeur", "Mood")} ${m}/5`}
                aria-pressed={draft.mood === m}
              >
                {["☁", "◔", "◑", "◕", "☀"][m - 1]}
              </button>
            ))}
          </span>
        </div>
        {aiDisabled && (
          <p className="journal-privacy-hint">
            <LockKeyhole size={14} />
            {t(
              "Protection renforcée · L’IA est désactivée pour garder vos mots dans votre coffre.",
              "Enhanced protection · AI is off to keep your words inside your vault.",
            )}
          </p>
        )}
        <div className="journal-writing-area" aria-busy={aiBusy}>
          {active && !aiDisabled && !aiBusy && !currentProposal && highlighted.trim() && createPortal(
            <div
              ref={selectionTools}
              className="journal-selection-tools"
              style={{ left: anchor.left, top: anchor.top, visibility: anchor.visible ? "visible" : "hidden" }}
              role="toolbar"
              aria-label={t("IA sur la sélection", "AI for selection")}
              onMouseDown={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSelection({ start: 0, end: 0 });
                  editor.current?.focus();
                }
              }}
            >
              <div className="journal-selection-actions">
                <button
                  disabled={busy || highlighted.length > 8000}
                  onClick={() => void edit("improve")}
                >
                  <Sparkles size={15} />
                  {t("Améliorer", "Improve writing")}
                </button>
                <button
                  disabled={busy || highlighted.length > 8000}
                  onClick={() => void edit("correct")}
                >
                  <SpellCheck size={16} />
                  {t("Corriger les fautes", "Fix spelling")}
                </button>
                <button
                  className="journal-tool-close"
                  aria-label={t("Fermer les outils IA", "Close AI tools")}
                  onClick={() => setSelection({ start: 0, end: 0 })}
                >
                  <X size={14} />
                </button>
              </div>
              <span className="journal-selection-disclosure">
                {highlighted.length > 8000
                  ? t(
                      "Sélectionnez au maximum 8 000 caractères.",
                      "Select up to 8,000 characters.",
                    )
                  : t(
                      "Seule la sélection sera envoyée à l’IA via Vercel.",
                      "Only this selection will be sent to AI through Vercel.",
                    )}
              </span>
            </div>, document.body
          )}
          {aiBusy && (
            <div className="journal-ai-pending" role="status">
              <Sparkles size={15} />
              <span>
                {t(
                  "Je prépare une proposition pour ce passage…",
                  "Preparing a suggestion for this passage…",
                )}
              </span>
              <button onClick={cancelAi}>{t("Annuler", "Cancel")}</button>
            </div>
          )}
          {currentProposal ? (
            <>
              <div
                className="journal-review-controls"
                role="toolbar"
                aria-label={t("Relire les modifications", "Review changes")}
              >
                <span>
                  <Sparkles size={14} />
                  {t("Proposition à relire", "Suggestion to review")}
                </span>
                <button
                  aria-pressed={previewResult}
                  onClick={() => setPreviewResult(!previewResult)}
                >
                  {previewResult
                    ? t("Voir les modifications", "Show changes")
                    : t("Voir le résultat", "Preview result")}
                </button>
                <button
                  className="journal-accept"
                  disabled={stale || busy}
                  onClick={() => finishSuggestion(true)}
                >
                  <Check size={15} />
                  {t("Accepter", "Accept")}
                </button>
                <button onClick={() => finishSuggestion(false)}>
                  <X size={15} />
                  {t("Refuser", "Reject")}
                </button>
              </div>
              {!previewResult && (
                <p className="journal-diff-key">
                  {t(
                    "Barré : retiré · Souligné : ajouté. Rien n’est appliqué avant votre accord.",
                    "Strikethrough: removed · Underline: added. Nothing changes until you accept.",
                  )}
                </p>
              )}
              <div
                className="journal-canvas journal-inline-review"
                aria-label={t(
                  "Texte avec modifications proposées",
                  "Text with suggested changes",
                )}
                tabIndex={0}
              >
                {currentProposal.original.slice(0, currentProposal.start)}
                {previewResult
                  ? currentProposal.text
                  : journalChanges(
                      currentProposal.original.slice(
                        currentProposal.start,
                        currentProposal.end,
                      ),
                      currentProposal.text,
                    ).map((part, i) =>
                      part.kind === "remove" ? (
                        <del key={i}>{part.text}</del>
                      ) : part.kind === "add" ? (
                        <ins key={i}>{part.text}</ins>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                {currentProposal.original.slice(currentProposal.end)}
              </div>
              {stale && (
                <p role="alert">
                  {t(
                    "La page a changé. Refusez cette proposition et relancez l’IA sur le passage à jour.",
                    "The page changed. Reject this suggestion and select the updated passage.",
                  )}
                </p>
              )}
            </>
          ) : (
            <textarea
              ref={editor}
              spellCheck={!encrypted}
              autoComplete="off"
              className="journal-canvas"
              aria-label={t("Texte du journal", "Journal text")}
              aria-describedby={
                !aiDisabled ? "journal-selection-help" : undefined
              }
              placeholder={t(
                "Commencez à écrire…\n\nUne pensée, un moment, quelques lignes pour vous.",
                "Start writing…\n\nA thought, a moment, a few lines for yourself.",
              )}
              maxLength={20000}
              value={draft.text}
              readOnly={busy || aiBusy}
              onChange={(e) => {
                change({ text: e.target.value });
                setSelection({ start: 0, end: 0 });
              }}
              onSelect={captureSelection}
              onPointerUp={captureSelection}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSelection({ start: 0, end: 0 });
                if (e.key === "Tab" && selectionTools.current && !e.shiftKey) {
                  e.preventDefault();
                  selectionTools.current.querySelector("button")?.focus();
                }
              }}
            />
          )}
        </div>
        {!aiDisabled && (
          <p id="journal-selection-help" className="journal-writing-hint">
            {t(
              "Sélectionnez un passage pour l’améliorer ou corriger les fautes. Vous gardez le dernier mot.",
              "Select a passage to improve it or fix spelling. You have the final say.",
            )}
          </p>
        )}
        {undo?.date === date && undo.after === draft.text && (
          <button
            className="text-button"
            onClick={() => {
              change({ text: undo.before });
              setUndo(null);
            }}
          >
            <Undo2 size={14} />
            {t("Annuler la correction", "Undo correction")}
          </button>
        )}
        <div className="journal-save">
          <span>
            {draft.text.length.toLocaleString(locale)} / 20 000 ·{" "}
            {key(draft) === draft.baseline
              ? t("À jour", "Up to date")
              : t("Brouillon non enregistré", "Unsaved draft")}
          </span>
          <button
            className="primary"
            disabled={busy || aiBusy || !!currentProposal || !draft.text.trim()}
            onClick={() => void save()}
          >
            {busy
              ? t("Enregistrement…", "Saving…")
              : t("Enregistrer ma page", "Save my page")}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
      </div>
      </>}
    </section>
  );
}
