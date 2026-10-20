import { lessons, type Lesson } from "./daily-program";
import type { ProgramProgress } from "./private-types";
import type { JournalEntry } from "./types";

export function lessonPrompt(lesson: Lesson, language: 0 | 1) {
  return `${language === 0 ? "Jour" : "Day"} ${lesson.day} · ${lesson.title[language]}`;
}

const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();
const headings = new Set(lessons.flatMap(l => [lessonPrompt(l, 0), lessonPrompt(l, 1)]));
const scaffolding = new Set(
  lessons.flatMap((l) => [lessonPrompt(l, 0), lessonPrompt(l, 1), ...l.question]),
);
const meaningful = (text: string) =>
  normalize(text).split("\n").some((line) => {
    const value = line.trim();
    return !!value && !scaffolding.has(value);
  });

// Exact known prompts delimit reflections, including several lessons on one page.
// This runs inside the personal workspace (locally when enhanced protection is on).
export function reflectionInEntry(lesson: Lesson, entry: Pick<JournalEntry, "text">) {
  const lines = normalize(entry.text).split("\n");
  const starts = lines.flatMap((line, i) => lesson.question.includes(line.trim()) ? [i] : []);
  if (!starts.length) return null;
  return starts.some((start) => {
    const rest = lines.slice(start + 1);
    const next = rest.findIndex((line) => headings.has(line.trim()));
    return meaningful((next < 0 ? rest : rest.slice(0, next)).join("\n"));
  });
}

export function journalStep(lesson: Lesson, entries: JournalEntry[], progress: ProgramProgress) {
  let started: JournalEntry | undefined;
  for (const entry of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
    const answer = reflectionInEntry(lesson, entry);
    const linked = progress.reflections[lesson.id] === entry.date;
    if (answer === true || (answer === null && linked && meaningful(entry.text))) {
      return { done: true, date: entry.date, started: true };
    }
    if (answer === false && !started) started = entry;
  }
  return { done: false, date: started?.date, started: !!started };
}

export function progressWithJournal(progress: ProgramProgress, entry: JournalEntry): ProgramProgress {
  const reflections = { ...progress.reflections };
  for (const lesson of lessons) {
    const answer = reflectionInEntry(lesson, entry);
    if (answer === true) reflections[lesson.id] = entry.date;
    else if (reflections[lesson.id] === entry.date &&
      (answer === false || !meaningful(entry.text))) delete reflections[lesson.id];
  }
  return { ...progress, reflections };
}

export function programSteps(progress: ProgramProgress, entries: JournalEntry[]) {
  const days = lessons.map((lesson) => ({
    lesson,
    reading: !!progress.completed[lesson.id],
    journal: journalStep(lesson, entries, progress),
  }));
  // The journal remains optional: the next reading also has its own action.
  const next = days.find((d) => !d.reading || !d.journal.done);
  return {
    days,
    next: next ? { ...next, kind: next.reading ? "journal" as const : "reading" as const } : null,
    readings: days.filter((d) => d.reading).length,
    journals: days.filter((d) => d.journal.done).length,
    complete: days.filter((d) => d.reading && d.journal.done).length,
  };
}
