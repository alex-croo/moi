"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Sparkles, SpellCheck, Undo2, X } from "lucide-react";
import type { JournalEntry } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { localToday } from "@/lib/units";
type Draft = {
  text: string;
  title: string;
  mood: number;
  revision: number;
  baseline: string;
};
const key = (d: { text: string; title: string; mood: number }) =>
  JSON.stringify([d.text, d.title, d.mood]);
export function JournalEditor({
  entries,
  locale,
  onSave,
}: {
  entries: JournalEntry[];
  locale: Locale;
  onSave: (data: {
    date: string;
    text: string;
    title: string;
    mood: number;
    expectedRevision: number;
  }) => Promise<JournalEntry>;
}) {
  const [date, setDate] = useState(localToday);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const editor = useRef<HTMLTextAreaElement>(null);
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
  useEffect(() => {
    if (editor.current) {
      editor.current.style.height = "auto";
      editor.current.style.height = `${Math.max(340, editor.current.scrollHeight)}px`;
    }
  }, [draft.text, date]);
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
    const start = selection.start === selection.end ? 0 : selection.start;
    const end =
      selection.start === selection.end ? draft.text.length : selection.end;
    const original = draft.text;
    const text = original.slice(start, end);
    if (!text.trim()) return;
    setError("");
    setProposal(null);
    setAiBusy(true);
    try {
      const response = await fetch("/api/journal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json();
      setProposal({ text: result.text, original, start, end, date });
    } catch (e) {
      setError(
        e instanceof Error && e.message === "429"
          ? t(
              "La limite de 20 propositions par heure est atteinte. Réessayez plus tard.",
              "The limit of 20 suggestions per hour has been reached. Please try later.",
            )
          : t(
              "L’IA n’est pas disponible pour le moment. Votre texte n’a pas changé.",
              "AI is currently unavailable. Your text has not changed.",
            ),
      );
    } finally {
      setAiBusy(false);
    }
  }
  const currentProposal = proposal?.date === date ? proposal : null;
  const stale = !!currentProposal && currentProposal.original !== draft.text;
  return (
    <section className="journal-page">
      <div className="journal-page-nav">
        <span>
          <BookOpen size={16} />
          {t("Mon journal", "My journal")}
        </span>
        <label>
          {t("Ouvrir une page", "Open a page")}
          <input
            type="date"
            aria-label={t("Date du journal", "Journal date")}
            value={date}
            disabled={busy || aiBusy}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setSelection({ start: 0, end: 0 });
                setError("");
                setStatus("");
              }
            }}
          />
        </label>
      </div>
      <div className="journal-paper">
        <span className="journal-page-icon">✦</span>
        <input
          className="journal-title"
          aria-label={t("Titre de la page", "Page title")}
          placeholder={t("Une nouvelle page", "A new page")}
          maxLength={160}
          value={draft.title}
          onChange={(e) => change({ title: e.target.value })}
          disabled={busy}
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
                disabled={busy}
                aria-label={`${t("Humeur", "Mood")} ${m}/5`}
                aria-pressed={draft.mood === m}
              >
                {["☁", "◔", "◑", "◕", "☀"][m - 1]}
              </button>
            ))}
          </span>
        </div>
        <div
          className="inline-ai-toolbar"
          aria-label={t("Édition assistée par IA", "AI editing")}
        >
          <span>
            <Sparkles size={15} />
            {selection.start !== selection.end
              ? t("Sur la sélection", "On selection")
              : t("Sur cette page", "On this page")}
          </span>
          <button
            disabled={aiBusy || busy || !draft.text.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void edit("improve")}
          >
            <Sparkles size={14} />
            {t("Améliorer le texte", "Improve writing")}
          </button>
          <button
            disabled={aiBusy || busy || !draft.text.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void edit("correct")}
          >
            <SpellCheck size={15} />
            {t("Corriger les fautes", "Fix spelling")}
          </button>
        </div>
        <p className="ai-disclosure">
          {t(
            "À votre demande, le texte sélectionné — ou toute la page sans sélection — est envoyé à l’IA via Vercel. Vous décidez d’accepter la proposition.",
            "When requested, selected text — or the whole page without a selection — is sent to AI through Vercel. You choose whether to accept the suggestion.",
          )}
        </p>
        <textarea
          ref={editor}
          className="journal-canvas"
          aria-label={t("Texte du journal", "Journal text")}
          placeholder={t(
            "Commencez à écrire…\n\nUne pensée, un moment, quelques lignes pour vous.",
            "Start writing…\n\nA thought, a moment, a few lines for yourself.",
          )}
          maxLength={20000}
          value={draft.text}
          disabled={busy}
          onChange={(e) => change({ text: e.target.value })}
          onSelect={(e) =>
            setSelection({
              start: e.currentTarget.selectionStart,
              end: e.currentTarget.selectionEnd,
            })
          }
        />
        {aiBusy && (
          <p role="status" className="ai-loading">
            <Sparkles size={16} />
            {t("Une proposition se prépare…", "Preparing a suggestion…")}
          </p>
        )}
        {currentProposal && (
          <aside
            className="ai-proposal"
            aria-label={t("Proposition de l’IA", "AI suggestion")}
          >
            <span className="eyebrow">
              {t("PROPOSITION À RELIRE", "SUGGESTION TO REVIEW")}
            </span>
            <div className="proposal-comparison">
              <div>
                <small>{t("Votre texte", "Your text")}</small>
                <p>
                  {currentProposal.original.slice(
                    currentProposal.start,
                    currentProposal.end,
                  )}
                </p>
              </div>
              <div>
                <small>{t("Proposition", "Suggestion")}</small>
                <p>{currentProposal.text}</p>
              </div>
            </div>
            {stale && (
              <p role="alert">
                {t(
                  "Le texte a changé depuis cette demande. Relancez l’IA pour obtenir une proposition à jour.",
                  "The text changed since this request. Ask AI again for an updated suggestion.",
                )}
              </p>
            )}
            <div className="proposal-actions">
              <button
                className="primary"
                disabled={stale || busy}
                onClick={() => {
                  const after =
                    draft.text.slice(0, currentProposal.start) +
                    currentProposal.text +
                    draft.text.slice(currentProposal.end);
                  setUndo({ before: draft.text, after, date });
                  change({ text: after });
                  setProposal(null);
                }}
              >
                <Check size={15} />
                {t("Accepter la proposition", "Accept suggestion")}
              </button>
              <button className="text-button" onClick={() => setProposal(null)}>
                <X size={15} />
                {t("Ignorer", "Dismiss")}
              </button>
            </div>
          </aside>
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
            disabled={busy || aiBusy || !draft.text.trim()}
            onClick={() => void save()}
          >
            {busy
              ? t("Enregistrement…", "Saving…")
              : t("Enregistrer ma page", "Save my page")}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
        {!!entries.length && (
          <details className="journal-history">
            <summary>
              {t("Mes pages précédentes", "Previous pages")} ({entries.length})
            </summary>
            {[...entries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => (
                <button
                  disabled={busy || aiBusy}
                  key={e.id}
                  onClick={() => {
                    setDate(e.date);
                    setSelection({ start: 0, end: 0 });
                    setStatus("");
                    setError("");
                  }}
                >
                  <span>{e.date}</span>
                  {e.title || e.text.slice(0, 70)}
                </button>
              ))}
          </details>
        )}
      </div>
    </section>
  );
}
