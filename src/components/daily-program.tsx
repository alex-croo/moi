"use client";
import { useText } from "./locale-provider";

import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, Circle, LockKeyhole, PenLine, Sprout, Flag } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { ProgramProgress, JournalPrompt } from "@/lib/private-types";
import type { JournalEntry } from "@/lib/types";
import { lessons, programSources, programState, completeLesson } from "@/lib/daily-program";
import { lessonPrompt, programSteps } from "@/lib/program-journal";
import { localToday } from "@/lib/units";

export function DailyProgram({ locale, progress, entries = [], onSave, onJournal, preview = false }: {
  locale: Locale;
  progress: ProgramProgress;
  entries?: JournalEntry[];
  onSave: (p: ProgramProgress) => Promise<void>;
  onJournal: (p: JournalPrompt) => void;
  preview?: boolean;
}) {
  const t = useText(locale);
  const lessonTitle = useRef<HTMLHeadingElement>(null);
  const state = programState(progress);
  const steps = programSteps(progress, entries);
  const [selected, setSelected] = useState(() => steps.next ? steps.next.lesson.day - 1 : state.index);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { lesson, reading, journal } = steps.days[selected];
  function select(index: number, scroll = true) {
    setSelected(index); setError("");
    if (scroll) requestAnimationFrame(() => {
      lessonTitle.current?.focus({ preventScroll: true });
      lessonTitle.current?.scrollIntoView({ block: "start" });
    });
  }
  function openJournal(index: number) {
    const day = steps.days[index];
    onJournal({ id: crypto.randomUUID(), lessonId: day.lesson.id,
      date: day.journal.date,
      title: lessonPrompt(day.lesson, locale === "fr" ? 0 : 1), question: t(...day.lesson.question) });
  }
  async function finishReading() {
    setBusy(true); setError("");
    try { await onSave(completeLesson(progress, lesson.id, localToday())); }
    catch { setError(t("La progression n’a pas pu être enregistrée. Réessayez sans fermer la page.", "Progress could not be saved. Retry without closing this page.")); }
    finally { setBusy(false); }
  }
  const milestones = [
    { day: 7, label: t("J’observe", "I notice") },
    { day: 14, label: t("Je simplifie", "I simplify") },
    { day: 21, label: t("J’ajuste", "I adapt") },
    { day: 31, label: t("Je continue", "I continue") },
  ];
  return <section className="program-page">
    <header className="program-hero">
      <div>
        <span className="eyebrow">{t("DU TEMPS POUR VOUS", "TIME FOR YOURSELF")}</span>
        <h1>{t("Des petits pas.", "Small steps.")}<br /><span>{t("Votre chemin.", "Your journey.")}</span></h1>
        <p>{t("31 journées pour apprendre, écrire et trouver vos repères. Avancez à votre rythme, une étape à la fois.", "31 days to learn, write and find your footing. Move at your pace, one step at a time.")}</p>
      </div>
      <img src="/brand/journey.webp" alt="" width={1024} height={688} />
    </header>
    {preview ? <p className="privacy-note">{t("Aperçu administrateur · Toutes les lectures sont accessibles. Aucune progression personnelle n’est chargée ou enregistrée.", "Admin preview · Every reading is available. No personal progress is loaded or saved.")}</p> : <>
      <div className="program-summary" aria-label={t("Votre avancement", "Your progress")}>
        <div><BookOpen size={18}/><strong>{steps.readings}<small> / 31</small></strong><span>{t("Lectures terminées", "Readings completed")}</span></div>
        <div><PenLine size={18}/><strong>{steps.journals}<small> / 31</small></strong><span>{t("Réflexions enregistrées", "Reflections saved")}</span></div>
        <div><Check size={18}/><strong>{steps.complete}<small> / 31</small></strong><span>{t("Journées complètes", "Days completed")}</span></div>
      </div>
      {steps.next ? <section className="program-resume" aria-label={t("Votre prochaine étape", "Your next step")}>
        <div className="resume-icon">{steps.next.kind === "reading" ? <BookOpen size={21}/> : <PenLine size={21}/>}</div>
        <div className="resume-copy"><span className="eyebrow">{t("REPRENDRE MON PARCOURS", "CONTINUE MY JOURNEY")}</span>
          <h2>{t("Jour", "Day")} {steps.next.lesson.day} · {t(...steps.next.lesson.title)}</h2>
          <p>{steps.next.kind === "reading" ? t("Votre prochaine lecture vous attend. Deux ou trois minutes pour vous.", "Your next reading is ready. Two or three minutes for yourself.") : t("La lecture est terminée. Il reste votre moment d’écriture, si vous en avez envie.", "The reading is complete. Your writing moment is next, if you feel like it.")}</p>
        </div>
        <div className="resume-actions"><button className="primary" onClick={() => steps.next!.kind === "journal" ? openJournal(steps.next!.lesson.day - 1) : select(steps.next!.lesson.day - 1)}>
          {steps.next.kind === "reading" ? t("Reprendre la lecture", "Continue reading") : t("Reprendre mon journal", "Continue my journal")}<ArrowRight size={16}/>
        </button>
        {steps.next.kind === "journal" && !state.finished && <button className="text-button" onClick={() => select(state.index)}>{t("Ou lire le jour", "Or read day")} {lessons[state.index].day}<ArrowRight size={14}/></button>}</div>
      </section> : <p className="privacy-note">{t("Vos 31 journées sont complètes. Vos lectures et vos réflexions restent à votre disposition.", "Your 31 days are complete. Your readings and reflections are always here to revisit.")}</p>}
    </>}
    <section className="program-progress">
      <div><span>{t("Les jalons de votre parcours", "Your journey milestones")}</span><small>{t("Au fil de vos lectures", "As you complete readings")}</small></div>
      <progress value={state.completed} max={31} aria-label={t("Lectures terminées", "Completed readings")}/>
      <div className="milestones">{milestones.map(m => <span className={state.completed >= m.day ? "reached" : ""} key={m.day}>
        {state.completed >= m.day ? <Check size={16}/> : <Flag size={16}/>}<strong>{m.label}</strong><small>{t("Jour", "Day")} {m.day}</small>
      </span>)}</div>
    </section>
    <div className="program-layout">
      <nav className="lesson-list" aria-label={t("Journées du programme", "Program days")}>
        {steps.days.map((day, i) => {
          const unlocked = preview || day.reading || (i === state.index && state.available);
          return <button key={day.lesson.id} disabled={!unlocked} aria-current={selected === i ? "step" : undefined} className={selected === i ? "selected" : ""} onClick={() => select(i)}>
            <span className="lesson-number">{String(day.lesson.day).padStart(2,"0")}</span>
            <span className="lesson-list-copy"><strong>{t(...day.lesson.title)}</strong>
              <span className="day-statuses">
                <span className={day.reading ? "done" : ""}>{!unlocked ? <LockKeyhole size={10}/> : day.reading ? <Check size={11}/> : <Circle size={10}/>} {t("Lecture", "Reading")}</span>
                <span className={day.journal.done ? "done" : ""}>{day.journal.done ? <Check size={11}/> : <Circle size={10}/>} {t("Journal", "Journal")}</span>
              </span>
              <span className="sr-only">{!unlocked ? t("À venir", "Upcoming") : `${day.reading ? t("Lecture terminée", "Reading completed") : t("Lecture à faire", "Reading to do")}. ${day.journal.done ? t("Journal enregistré", "Journal saved") : t("Journal à écrire", "Journal to write")}`}</span>
            </span>
          </button>;
        })}
      </nav>
      <article className="lesson-paper">
        <div className="lesson-meta"><span><BookOpen size={15}/> {t("Jour", "Day")} {lesson.day} · {t("2–3 minutes", "2–3 minutes")}</span><span>{reading ? t("À relire", "Revisit") : t("Un moment pour vous", "A moment for you")}</span></div>
        <h2 ref={lessonTitle} tabIndex={-1}>{t(...lesson.title)}</h2>
        {!preview && <div className="lesson-checklist">
          <span className={reading ? "done" : ""}>{reading ? <Check size={15}/> : <Circle size={15}/>} {reading ? t("Lecture terminée", "Reading completed") : t("Lecture à faire", "Reading to do")}</span>
          <button className={journal.done ? "done" : ""} onClick={() => openJournal(selected)}>{journal.done ? <Check size={15}/> : <PenLine size={15}/>} {journal.done ? t("Journal enregistré", "Journal saved") : journal.started ? t("Journal à poursuivre", "Journal to continue") : t("Journal à écrire", "Journal to write")}<ArrowRight size={13}/></button>
        </div>}
        {t(...lesson.body).split("\n\n").map((p,i) => <p key={i}>{p}</p>)}
        <aside className="lesson-action"><Sprout size={22}/><div><strong>{t("Un petit pas à essayer", "A small step to try")}</strong><p>{t(...lesson.action)}</p></div></aside>
        <div className="lesson-finish">
          <span>{reading ? <><Check size={16}/>{t("Lecture terminée", "Reading completed")}</> : t("Un repère à garder pour la suite.", "A thought to carry with you.")}</span>
          {!preview && !reading && selected === state.index && <button className="primary" disabled={busy} onClick={() => void finishReading()}>{busy ? t("Enregistrement…", "Saving…") : t("Terminer cette lecture", "Complete this reading")}<Check size={16}/></button>}
        </div>
        <section className="lesson-reflection"><span className="eyebrow">{t("VOTRE MOMENT D’ÉCRITURE", "YOUR WRITING MOMENT")}</span><h3>{t("Et pour vous?", "What about you?")}</h3><p>{t(...lesson.question)}</p>
          {!preview && <button className="secondary" onClick={() => openJournal(selected)}><PenLine size={15}/>{journal.done ? t("Relire ma réflexion", "Revisit my reflection") : journal.started ? t("Poursuivre ma réflexion", "Continue my reflection") : t("Écrire ma réflexion", "Write my reflection")}<ArrowRight size={15}/></button>}
          <small>{t("Quelques mots suffisent. Votre réflexion est cochée après son enregistrement. Écrire reste votre choix.", "A few words are enough. Your reflection is checked after you save it. Writing remains your choice.")}</small>
        </section>
        {!preview && reading && !state.finished && <div className="lesson-next"><button className="text-button" onClick={() => select(state.index)}>{t("Passer au jour", "Continue to day")} {lessons[state.index].day}<ArrowRight size={16}/></button></div>}
        {error && <p role="alert">{t(error)}</p>}
        <details className="lesson-source"><summary>{t("Le repère scientifique", "Background source")}</summary><a href={programSources[lesson.source].url} target="_blank" rel="noreferrer">{programSources[lesson.source].label}</a><p>{t("Contenu éducatif général. Il ne remplace pas un accompagnement médical personnalisé.", "General educational content. It does not replace personalized medical care.")}</p></details>
      </article>
    </div>
  </section>;
}
