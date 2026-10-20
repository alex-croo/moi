"use client";
import { useRef, useState } from "react";
import {
  BookOpen,
  Check,
  LockKeyhole,
  PenLine,
  Sprout,
  Flag,
} from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { ProgramProgress, JournalPrompt } from "@/lib/private-types";
import {
  lessons,
  programSources,
  programState,
  completeLesson,
} from "@/lib/daily-program";
import { localToday } from "@/lib/units";
export function DailyProgram({
  locale,
  progress,
  onSave,
  onJournal,
  preview = false,
}: {
  locale: Locale;
  progress: ProgramProgress;
  onSave: (p: ProgramProgress) => Promise<void>;
  onJournal: (p: JournalPrompt) => void;
  preview?: boolean;
}) {
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const lessonTitle = useRef<HTMLHeadingElement>(null);
  const state = programState(progress);
  const [selected, setSelected] = useState(state.index),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lesson = lessons[selected],
    completed = !!progress.completed[lesson.id];
  const milestones = [
    { day: 7, label: t("J’observe", "I notice") },
    { day: 14, label: t("Je simplifie", "I simplify") },
    { day: 21, label: t("J’ajuste", "I adapt") },
    { day: 31, label: t("Je continue", "I continue") },
  ];
  return (
    <section className="program-page">
      <div className="page-heading">
        <span className="eyebrow">
          {t("UN JOUR À LA FOIS", "ONE DAY AT A TIME")}
        </span>
        <h1>{t("Mon programme.", "My program.")}</h1>
        <p>
          {t(
            "31 journées pour mieux vous connaître et trouver vos repères. Une lecture à la fois, à votre rythme.",
            "31 days to get to know yourself and find your footing. One reading at a time, at your own pace.",
          )}
        </p>
      </div>
      {preview && (
        <p className="privacy-note">
          {t(
            "Aperçu administrateur · Toutes les lectures sont accessibles. Aucune progression personnelle n’est chargée ou enregistrée.",
            "Admin preview · Every reading is available. No personal progress is loaded or saved.",
          )}
        </p>
      )}
      <div className="program-progress">
        <div>
          <span>{t("Mon chemin parcouru", "My journey so far")}</span>
          <strong>{state.completed} / 31</strong>
        </div>
        <progress
          value={state.completed}
          max={31}
          aria-label={t("Lectures terminées", "Completed readings")}
        />
        <div className="milestones">
          {milestones.map((m) => (
            <span
              className={state.completed >= m.day ? "reached" : ""}
              key={m.day}
            >
              {state.completed >= m.day ? (
                <Check size={16} />
              ) : (
                <Flag size={16} />
              )}
              <strong>{m.label}</strong>
              <small>
                {t("Jour", "Day")} {m.day}
              </small>
            </span>
          ))}
        </div>
      </div>
      {state.finished && (
        <p className="privacy-note">
          {t(
            "Votre parcours de 31 journées est terminé. Toutes les lectures restent à votre disposition.",
            "Your 31-day journey is complete. All readings remain available to revisit.",
          )}
        </p>
      )}
      <div className="program-layout">
        <nav
          className="lesson-list"
          aria-label={t("Journées du programme", "Program days")}
        >
          {lessons.map((l, i) => {
            const unlocked =
              preview ||
              !!progress.completed[l.id] ||
              (i === state.index && state.available);
            return (
              <button
                key={l.id}
                disabled={!unlocked}
                aria-current={selected === i ? "step" : undefined}
                className={selected === i ? "selected" : ""}
                onClick={() => {
                  setSelected(i);
                  setError("");
                }}
              >
                <span className="lesson-number">
                  {progress.completed[l.id] ? (
                    <Check size={15} />
                  ) : !unlocked ? (
                    <LockKeyhole size={13} />
                  ) : (
                    String(l.day).padStart(2, "0")
                  )}
                </span>
                <span>{t(...l.title)}</span>
              </button>
            );
          })}
        </nav>
        <article className="lesson-paper">
          <div className="lesson-meta">
            <span>
              <BookOpen size={15} /> {t("Jour", "Day")} {lesson.day} ·{" "}
              {t("2–3 minutes", "2–3 minutes")}
            </span>
            <span>
              {completed
                ? t("À relire", "Revisit")
                : t("Un moment pour vous", "A moment for you")}
            </span>
          </div>
          <h2 ref={lessonTitle} tabIndex={-1}>
            {t(...lesson.title)}
          </h2>
          {t(...lesson.body)
            .split("\n\n")
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          <aside className="lesson-action">
            <Sprout size={22} />
            <div>
              <strong>
                {t("Un petit pas à essayer", "A small step to try")}
              </strong>
              <p>{t(...lesson.action)}</p>
            </div>
          </aside>
          <section className="lesson-reflection">
            <PenLine size={22} />
            <h3>
              {t("De la lecture à mon journal", "From reading to my journal")}
            </h3>
            <p>{t(...lesson.question)}</p>
            <button
              className="secondary"
              onClick={() =>
                onJournal({
                  id: crypto.randomUUID(),
                  title: `${t("Jour", "Day")} ${lesson.day} · ${t(...lesson.title)}`,
                  question: t(...lesson.question),
                })
              }
            >
              {t("Poursuivre dans mon journal", "Continue in my journal")}
            </button>
            <small>
              {t(
                "La question s’ajoute à votre page du jour. Votre texte existant est conservé. Écrire reste votre choix.",
                "The question is added to today’s page. Existing writing is preserved. Writing remains your choice.",
              )}
            </small>
          </section>
          <div className="lesson-finish">
            <span>
              {completed ? (
                <>
                  <Check size={16} />
                  {t("Lecture terminée", "Reading completed")}
                </>
              ) : (
                t(
                  "Vous pouvez garder cette réflexion pour vous.",
                  "You may keep this reflection to yourself.",
                )
              )}
            </span>
            {!preview &&
              !completed &&
              selected === state.index &&
              state.available && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await onSave(
                        completeLesson(progress, lesson.id, localToday()),
                      );
                    } catch {
                      setError(
                        t(
                          "La progression n’a pas pu être enregistrée. Réessayez sans fermer la page.",
                          "Progress could not be saved. Retry without closing the page.",
                        ),
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy
                    ? t("Enregistrement…", "Saving…")
                    : t("Terminer cette lecture", "Complete this reading")}
                </button>
              )}
            {!preview && completed && !state.finished && (
              <button
                className="primary"
                onClick={() => {
                  setSelected(state.index);
                  setError("");
                  requestAnimationFrame(() => {
                    lessonTitle.current?.focus({ preventScroll: true });
                    lessonTitle.current?.scrollIntoView({ block: "start" });
                  });
                }}
              >
                {t("Passer au jour", "Continue to day")} {lessons[state.index].day}
              </button>
            )}
          </div>
          {error && <p role="alert">{error}</p>}
          <details className="lesson-source">
            <summary>
              {t("Le repère scientifique", "Background source")}
            </summary>
            <p>
              {t(
                "Un exercice original d’i am able., éclairé par cette ressource. Ce programme éducatif n’a pas fait l’objet d’une validation clinique et ne remplace pas un accompagnement personnalisé.",
                "An original i am able. exercise informed by this resource. This educational program has not been clinically validated and does not replace individual care.",
              )}
            </p>
            <a
              href={programSources[lesson.source].url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {programSources[lesson.source].label}
            </a>
          </details>
        </article>
      </div>
    </section>
  );
}
