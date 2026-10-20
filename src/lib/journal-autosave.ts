import { z } from "zod";
import { journalDraftKey as key, type JournalDraft } from "./journal-library";
import type { JournalEntry } from "./types";
import { sealJournalRecovery, openJournalRecovery } from "./vault-crypto";

export type JournalWrite = { date: string; text: string; title: string; mood: number; expectedRevision: number };
export type SyncDraft = JournalDraft;
export type SaveState = "pending" | "saving" | "saved" | "offline" | "conflict";
export type JournalSyncBridge = { flush?: () => Promise<void> };
const pending = (draft: SyncDraft) => key(draft) !== draft.baseline || draft.sent !== undefined;
const schema = z.record(z.iso.date(), z.object({
  text: z.string().max(20000), title: z.string().max(160), mood: z.number().int().min(1).max(5),
  revision: z.number().int().min(0), baseline: z.string().max(140000), sent: z.string().max(140000).optional(),
}).strict());
export const draftFromEntry = (entry?: JournalEntry): SyncDraft => {
  const value = { text: entry?.text || "", title: entry?.title || "", mood: entry?.mood || 3, revision: entry?.revision || 0 };
  return { ...value, baseline: key(value) };
};

// One recovery record per authenticated owner and browser tab. In enhanced mode,
// only ciphertext is stored; the vault key is never persisted or sent elsewhere.
export class JournalRecovery {
  private generation = 0;
  durable = true;
  failed = false;
  constructor(readonly owner: string, private storage: () => Storage, public cryptoKey: CryptoKey | null = null) {}
  get storageKey() { return `iamable:journal-recovery:v1:${this.owner}`; }
  async read(): Promise<Record<string, SyncDraft>> {
    const raw = this.storage().getItem(this.storageKey);
    if (!raw) return {};
    const record = JSON.parse(raw);
    if (record.version !== 1 || record.owner !== this.owner) throw Error("recovery");
    const data = record.sealed
      ? this.cryptoKey ? await openJournalRecovery(this.cryptoKey, record.sealed, this.owner) : (() => { throw Error("locked"); })()
      : record.drafts;
    return schema.parse(data);
  }
  write(drafts: Record<string, SyncDraft>): Promise<void> {
    const generation = ++this.generation;
    const changes = Object.fromEntries(Object.entries(drafts).filter(([,draft]) => pending(draft)));
    this.durable = false;
    const commit = (record: object | null) => {
      if (generation !== this.generation) return;
      if (record) this.storage().setItem(this.storageKey, JSON.stringify(record));
      else this.storage().removeItem(this.storageKey);
      this.durable = true;
      this.failed = false;
    };
    const fail = (error: unknown) => { if (generation === this.generation) this.failed = true; throw error; };
    try {
      if (!Object.keys(changes).length) { commit(null); return Promise.resolve(); }
      if (!this.cryptoKey) { commit({ version: 1, owner: this.owner, drafts: changes }); return Promise.resolve(); }
      return sealJournalRecovery(this.cryptoKey, changes, this.owner)
        .then(sealed => commit({ version: 1, owner: this.owner, sealed })).catch(fail);
    } catch (error) { return Promise.reject(error).catch(fail); }
  }
}

export class JournalAutosave {
  drafts: Record<string, SyncDraft> = {};
  states: Record<string, SaveState> = {};
  ready = false;
  recoveryError = false;
  onChange = () => {};
  private timer?: ReturnType<typeof setTimeout>;
  private flight: Promise<void> | null = null;
  private starting: Promise<void> | null = null;
  private checkpoint: Promise<void> = Promise.resolve();
  private recoveryReadable = true;
  private stopped = false;
  constructor(public recovery: JournalRecovery, public save: (value: JournalWrite) => Promise<JournalEntry>, private delay = 500, private retryDelay = 5000) {}
  private publish() { this.onChange(); }
  private backup() {
    if (!this.recoveryReadable) return;
    this.checkpoint = this.recovery.write(this.drafts)
      .then(() => { this.recoveryError = this.recovery.failed; })
      .catch(() => { this.recoveryError = true; })
      .then(() => this.publish());
  }
  initialize(entries: JournalEntry[]) {
    this.stopped = false;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      try {
        const recovered = await this.recovery.read();
        for (const [date, draft] of Object.entries(recovered)) {
          const remote = draftFromEntry(entries.find(entry => entry.date === date));
          if (key(remote) === key(draft) && (!draft.sent || draft.sent === key(draft))) continue;
          if (key(remote) === draft.baseline || key(remote) === draft.sent) {
            this.drafts[date] = { ...draft, revision: remote.revision, baseline: key(remote) };
            this.states[date] = "pending";
          } else {
            this.drafts[date] = draft;
            this.states[date] = "conflict";
          }
        }
        this.backup();
      } catch {
        // Preserve an unreadable copy rather than overwriting it with a new page.
        this.recoveryError = true;
        this.recoveryReadable = false;
        this.recovery.durable = false;
      }
      this.ready = true;
      this.publish();
      this.schedule();
    })();
    return this.starting;
  }
  update(date: string, next: SyncDraft) {
    this.drafts = { ...this.drafts, [date]: next };
    if (this.states[date] !== "conflict") this.states[date] = pending(next) ? "pending" : "saved";
    this.backup(); // Standard-mode checkpoint is synchronous, before this event returns.
    this.publish();
    this.schedule();
  }
  private schedule(delay = this.delay) {
    clearTimeout(this.timer);
    if (this.stopped) return;
    this.timer = setTimeout(() => { void this.flush(); }, delay);
  }
  stop() { this.stopped = true; clearTimeout(this.timer); }
  hasPending() { return Object.values(this.drafts).some(pending); }
  async requireSynced() {
    await this.flush();
    if (this.hasPending()) throw Error("journal_pending");
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (!this.ready || this.stopped) return Promise.resolve();
    if (this.flight) return this.flight;
    this.flight = this.run().finally(() => { this.flight = null; });
    return this.flight;
  }
  private async run() {
    const attempted = new Set<string>();
    while (!this.stopped) {
      const date = Object.keys(this.drafts).find(date => !attempted.has(date) && this.states[date] !== "conflict" && pending(this.drafts[date]));
      if (!date) break;
      const sent = { ...this.drafts[date] };
      this.drafts[date] = { ...sent, sent: key(sent) };
      this.states[date] = "saving";
      this.backup();
      await this.checkpoint;
      if (this.stopped) break;
      this.publish();
      try {
        const result = await this.save({ date, text: sent.text, title: sent.title, mood: sent.mood, expectedRevision: sent.revision });
        const saved = draftFromEntry(result), latest = this.drafts[date];
        // Keep typing uninterrupted. An older acknowledgement cannot replace newer words.
        this.drafts = { ...this.drafts, [date]: key(latest) === key(sent) ? saved : { ...latest, revision: saved.revision, baseline: saved.baseline, sent: undefined } };
        this.states[date] = key(this.drafts[date]) === saved.baseline ? "saved" : "pending";
        this.backup();
      } catch (error) {
        this.states[date] = error instanceof Error && error.message === "conflict" ? "conflict" : "offline";
        attempted.add(date);
        if (this.states[date] === "offline") this.schedule(this.retryDelay);
      }
      this.publish();
    }
  }
}
