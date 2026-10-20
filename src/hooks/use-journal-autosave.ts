"use client";
import { useEffect, useRef, useState } from "react";
import type { JournalEntry } from "@/lib/types";
import { JournalAutosave, JournalRecovery, type JournalSyncBridge, type JournalWrite } from "@/lib/journal-autosave";
export function useJournalAutosave(entries: JournalEntry[], onSave: (value: JournalWrite) => Promise<JournalEntry>, owner: string, cryptoKey: CryptoKey | null, bridge?: JournalSyncBridge) {
  const latestSave = useRef(onSave);
  latestSave.current = onSave;
  const [sync] = useState(() => new JournalAutosave(new JournalRecovery(owner, () => sessionStorage, cryptoKey), value => latestSave.current(value)));
  sync.recovery.cryptoKey = cryptoKey;
  const [, render] = useState(0);
  useEffect(() => {
    let alive = true;
    sync.onChange = () => { if (alive) render(value => value + 1); };
    void sync.initialize(entries);
    const flush = () => { void sync.flush(); };
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    const before = (event: BeforeUnloadEvent) => {
      // No prompt when the latest text is either on the server or recoverable.
      if (sync.hasPending() && !sync.recovery.durable) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("online", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("beforeunload", before);
    if (bridge) bridge.flush = () => sync.requireSynced();
    return () => {
      alive = false;
      sync.stop();
      window.removeEventListener("online", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("beforeunload", before);
      if (bridge) bridge.flush = undefined;
    };
  }, [sync, bridge]);
  return sync;
}
