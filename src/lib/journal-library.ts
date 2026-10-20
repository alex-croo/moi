import type { JournalEntry } from "./types";

export type JournalDraft = {
  text: string;
  title: string;
  mood: number;
  revision: number;
  baseline: string;
};
export const journalDraftKey = (d: { text: string; title: string; mood: number }) =>
  JSON.stringify([d.text, d.title, d.mood]);

// Drafts stay in the mounted editor, never in browser storage or analytics.
export function journalPages(entries: JournalEntry[], drafts: Record<string, JournalDraft>) {
  const pages = new Map(entries.map(entry => [entry.date, { ...entry, dirty: false }]));
  for (const [date, draft] of Object.entries(drafts)) {
    const dirty = journalDraftKey(draft) !== draft.baseline;
    if (!pages.has(date) && !dirty) continue;
    pages.set(date, {
      id: pages.get(date)?.id || date, date, title: draft.title,
      text: draft.text, mood: draft.mood, revision: draft.revision, dirty,
    });
  }
  return [...pages.values()].sort((a, b) => b.date.localeCompare(a.date));
}
export function journalPageTitle(page: { title?: string; text: string } | undefined, fallback: string) {
  return page?.title?.trim() || page?.text.trim().split("\n")[0].slice(0, 70) || fallback;
}
export function filterJournalPages<T extends { title?: string; text: string; date: string; dirty: boolean }>(pages: T[], query: string, draftsOnly = false) {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const term = normalize(query.trim());
  return pages.filter(page => (!draftsOnly || page.dirty) && normalize(`${page.title || ""} ${page.text} ${page.date}`).includes(term));
}
