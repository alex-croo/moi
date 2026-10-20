import { journalDraftKey } from "./journal-library";
import type { JournalEntry } from "./types";
import type { JournalWrite } from "./journal-autosave";

const content = (entry?: JournalEntry) => journalDraftKey({
  text: entry?.text || "", title: entry?.title || "", mood: entry?.mood || 3,
});

// A retry may follow a lost response or another page changing the workspace.
// Never replace a different journal entry automatically.
export function reconcileJournal(base: JournalEntry | undefined, remote: JournalEntry | undefined, write: JournalWrite) {
  if (remote && content(remote) === journalDraftKey(write)) return "acknowledged";
  if ((base?.revision || 0) !== write.expectedRevision || content(base) !== content(remote)) throw Error("conflict");
  return { ...write, expectedRevision: remote?.revision || 0 };
}
