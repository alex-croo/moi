import { test, expect } from "@playwright/test";
import { JournalAutosave, JournalRecovery, draftFromEntry, type JournalWrite } from "../src/lib/journal-autosave";
import { reconcileJournal } from "../src/lib/journal-reconcile";
import { createVault } from "../src/lib/vault-crypto";
import { applyPrivateMutation } from "../src/lib/private-mutations";
import { demoData } from "../src/lib/demo";
import type { JournalEntry } from "../src/lib/types";

const date = "2026-10-20";
const original: JournalEntry = { id: "entry", date, title: "Un moment", text: "Avant.", mood: 3, revision: 1 };
const memory = () => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index] || null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }, clear: () => values.clear(),
  } satisfies Storage;
};
const saved = (write: JournalWrite): JournalEntry => ({ ...write, id: "entry", revision: write.expectedRevision + 1 });
const controller = (storage: Storage, save = async (write: JournalWrite) => saved(write), key: CryptoKey | null = null) =>
  new JournalAutosave(new JournalRecovery("owner-a", () => storage, key), save, 60000, 60000);

test("every change is recoverable synchronously, before the debounce or a refresh", async () => {
  const storage = memory(), first = controller(storage);
  await first.initialize([original]);
  first.update(date, { ...draftFromEntry(original), text: "Une pensée.\n\nUne autre.", title: "Ma journée", mood: 5 });
  expect(storage.getItem(first.recovery.storageKey)).toContain("Ma journée");
  first.stop();
  const refreshed = controller(storage);
  try {
    await refreshed.initialize([original]);
    expect(refreshed.drafts[date]).toMatchObject({ text: "Une pensée.\n\nUne autre.", title: "Ma journée", mood: 5 });
    await refreshed.flush();
    expect(refreshed.hasPending()).toBe(false);
    expect(storage.length).toBe(0);
  } finally { refreshed.stop(); }
});

test("typing during a request is never replaced by its older response; writes are serialized", async () => {
  let release!: (entry: JournalEntry) => void;
  const calls: JournalWrite[] = [];
  const sync = controller(memory(), write => {
    calls.push(write);
    return calls.length === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(saved(write));
  });
  try {
    await sync.initialize([original]);
    sync.update(date, { ...draftFromEntry(original), text: "Première phrase." });
    const flight = sync.flush();
    await expect.poll(() => calls.length).toBe(1);
    sync.update(date, { ...sync.drafts[date], text: "Première phrase.\n\nEt la suite.", mood: 4 });
    release(saved(calls[0]));
    await flight;
    expect(calls.map(write => write.expectedRevision)).toEqual([1, 2]);
    expect(sync.drafts[date].text).toBe("Première phrase.\n\nEt la suite.");
    expect(sync.drafts[date].mood).toBe(4);
    expect(sync.states[date]).toBe("saved");
  } finally { sync.stop(); }
});

test("undo to the original while a write is in flight remains recoverable", async () => {
  const storage = memory();
  let release!: (entry: JournalEntry) => void;
  const sync = controller(storage, () => new Promise(resolve => { release = resolve; }));
  await sync.initialize([original]);
  sync.update(date, { ...draftFromEntry(original), text: "Temporary." });
  const flight = sync.flush();
  await expect.poll(() => !!release).toBe(true);
  sync.update(date, { ...sync.drafts[date], text: original.text });
  expect(sync.hasPending()).toBe(true);
  const copy = storage.getItem(sync.recovery.storageKey)!;
  expect(copy).toContain("Temporary.");
  const recoveredStorage = memory();
  recoveredStorage.setItem(sync.recovery.storageKey, copy);
  const refreshed = controller(recoveredStorage);
  try {
    await refreshed.initialize([original]);
    expect(refreshed.hasPending()).toBe(true);
    await refreshed.flush();
    expect(refreshed.drafts[date].text).toBe(original.text);
  } finally {
    refreshed.stop();
    // Resolve the old request with the desired text to finish without another call.
    release({ ...original, text: original.text, revision: 2 });
    await flight;
    sync.stop();
  }
});

test("offline changes survive refresh, retry automatically, and reconcile a lost acknowledgement", async () => {
  const storage = memory();
  const sync = controller(storage, async () => { throw Error("network"); });
  await sync.initialize([original]);
  sync.update(date, { ...draftFromEntry(original), text: "Conservé hors connexion." });
  await sync.flush();
  expect(sync.states[date]).toBe("offline");
  sync.stop();
  const refreshed = controller(storage);
  try {
    await refreshed.initialize([original]);
    await refreshed.flush();
    expect(refreshed.drafts[date].text).toBe("Conservé hors connexion.");
    expect(refreshed.states[date]).toBe("saved");
    expect(storage.length).toBe(0);
  } finally { refreshed.stop(); }

  const write = { ...original, title: original.title!, text: "Serveur déjà à jour.", expectedRevision: 1 };
  expect(reconcileJournal(original, saved(write), write)).toBe("acknowledged");
  expect(reconcileJournal(original, { ...original, revision: 9 }, write)).toMatchObject({ expectedRevision: 9 });
  expect(() => reconcileJournal(original, { ...original, text: "Autre version" }, write)).toThrow("conflict");
});

test("a genuine multi-tab conflict retains the local copy and never overwrites the server", async () => {
  const storage = memory(), sync = controller(storage);
  await sync.initialize([original]);
  sync.update(date, { ...draftFromEntry(original), text: "Version locale" });
  sync.stop();
  let calls = 0;
  const refreshed = controller(storage, async write => { calls++; return saved(write); });
  try {
    await refreshed.initialize([{ ...original, text: "Version distante", revision: 2 }]);
    expect(refreshed.states[date]).toBe("conflict");
    await expect(refreshed.requireSynced()).rejects.toThrow("journal_pending");
    expect(calls).toBe(0);
    expect(refreshed.drafts[date].text).toBe("Version locale");
    expect(storage.length).toBe(1);
  } finally { refreshed.stop(); }
});

test("title-only pages and clearing all text are saved, including program reflection updates", async () => {
  let data = { ...demoData, journal: [original], program: { completed: {}, reflections: {} } };
  const sync = controller(memory(), async write => {
    data = { ...demoData, ...applyPrivateMutation(data, "journal", write) };
    return data.journal.find(entry => entry.date === write.date)!;
  });
  try {
    await sync.initialize(data.journal);
    sync.update(date, { ...draftFromEntry(original), text: "", title: "Titre seulement" });
    await sync.flush();
    expect(data.journal[0]).toMatchObject({ text: "", title: "Titre seulement", revision: 2 });
    sync.update(date, { ...sync.drafts[date], title: "", mood: 4 });
    await sync.flush();
    expect(data.journal[0]).toMatchObject({ text: "", title: "", mood: 4, revision: 3 });
  } finally { sync.stop(); }
});

test("enhanced recovery stores only authenticated ciphertext, never the key or journal", async () => {
  const storage = memory();
  const { key } = await createVault("owner-a", "Une longue phrase pour le test uniquement.", {});
  const first = controller(storage, undefined, key);
  await first.initialize([original]);
  first.update(date, { ...draftFromEntry(original), text: "Texte sensible synthétique", title: "Titre sensible" });
  await expect.poll(() => first.recovery.durable).toBe(true);
  const raw = storage.getItem(first.recovery.storageKey)!;
  expect(raw).not.toContain("sensible");
  expect(raw).not.toContain('"drafts"');
  expect(raw).not.toContain('"key"');
  const recovered = await new JournalRecovery("owner-a", () => storage, key).read();
  expect(recovered[date].text).toBe("Texte sensible synthétique");
  const other = new JournalRecovery("owner-b", () => storage, key);
  storage.setItem(other.storageKey, raw.replace('"owner":"owner-a"', '"owner":"owner-b"'));
  await expect(other.read()).rejects.toThrow();
  first.stop();
});

test("unavailable browser storage is reported, while server autosave still succeeds", async () => {
  let blocked = true;
  const storage = memory(), set = storage.setItem;
  storage.setItem = (key, value) => { if (blocked) throw Error("quota"); set(key, value); };
  const sync = controller(storage);
  try {
    await sync.initialize([original]);
    sync.update(date, { ...draftFromEntry(original), text: "À protéger." });
    await expect.poll(() => sync.recoveryError).toBe(true);
    expect(sync.recovery.durable).toBe(false);
    blocked = false;
    await sync.flush();
    expect(sync.hasPending()).toBe(false);
    await expect.poll(() => sync.recoveryError).toBe(false);
  } finally { sync.stop(); }
});

test("an unreadable recovery record is preserved instead of silently discarded", async () => {
  const storage = memory(), sync = controller(storage);
  storage.setItem(sync.recovery.storageKey, "corrupt-recovery");
  try {
    await sync.initialize([original]);
    sync.update(date, { ...draftFromEntry(original), text: "Nouveaux mots." });
    expect(sync.recoveryError).toBe(true);
    expect(storage.getItem(sync.recovery.storageKey)).toBe("corrupt-recovery");
    await sync.flush();
    expect(sync.states[date]).toBe("saved");
    expect(storage.getItem(sync.recovery.storageKey)).toBe("corrupt-recovery");
  } finally { sync.stop(); }
});

test("failed requests retry without a button and all edited dates eventually synchronize", async () => {
  let online = false, writes = 0;
  const storage = memory();
  const sync = new JournalAutosave(new JournalRecovery("owner-a", () => storage), async write => {
    if (!online) throw Error("network");
    writes++;
    return saved(write);
  }, 5, 10);
  try {
    await sync.initialize([original]);
    sync.update(date, { ...draftFromEntry(original), text: "Aujourd’hui." });
    sync.update("2026-10-19", { ...draftFromEntry(), text: "Hier." });
    await expect.poll(() => sync.states[date]).toBe("offline");
    online = true;
    await expect.poll(() => sync.hasPending()).toBe(false);
    expect(writes).toBe(2);
  } finally { sync.stop(); }
});

test("unmounting stops retries and prevents queued drafts being sent after account navigation", async () => {
  let reject!: (error: Error) => void, calls = 0;
  const sync = controller(memory(), () => {
    calls++;
    return new Promise((_, fail) => { reject = fail; });
  });
  await sync.initialize([original]);
  sync.update(date, { ...draftFromEntry(original), text: "Reste dans ce compte." });
  const flight = sync.flush();
  await expect.poll(() => calls).toBe(1);
  sync.update("2026-10-19", { ...draftFromEntry(), text: "Une autre page privée." });
  sync.stop();
  reject(Error("network"));
  await flight;
  await sync.flush();
  expect(calls).toBe(1);
  expect(sync.hasPending()).toBe(true);
});
