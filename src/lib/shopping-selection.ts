import { periodKey, type ShoppingMutation } from "./shopping";
type Range = { start: string; end: string };
type Change = { range: Range; ingredientId: string; checked: boolean; version: number };
export type SelectionSnapshot = { overrides: Record<string, Change>; saving: boolean; error: boolean };

/** Preserve the latest tap while coalescing changes behind one in-flight write. */
export class ShoppingSelectionQueue {
  snapshot: SelectionSnapshot = { overrides: {}, saving: false, error: false };
  private pending = new Map<string, Change>();
  private running: Promise<void> | null = null;
  private sequence = 0;
  notify: () => void = () => {};
  constructor(public save: (m: ShoppingMutation) => Promise<void>) {}
  private update(patch: Partial<SelectionSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.notify(); }
  selected(range: Range, saved: string[]) {
    const selected = new Set(saved);
    for (const change of Object.values(this.snapshot.overrides)) if (periodKey(change.range.start, change.range.end) === periodKey(range.start, range.end))
      change.checked ? selected.add(change.ingredientId) : selected.delete(change.ingredientId);
    return [...selected];
  }
  select(range: Range, ids: string[], checked: boolean) {
    const overrides = { ...this.snapshot.overrides };
    for (const ingredientId of ids) {
      const key = `${periodKey(range.start, range.end)}:${ingredientId}`;
      const value = { range: { ...range }, ingredientId, checked, version: ++this.sequence };
      overrides[key] = value; this.pending.set(key, value);
    }
    this.update({ overrides }); void this.flush();
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    this.update({ saving: true, error: false });
    const work = async () => {
      while (this.pending.size) {
        const first = this.pending.values().next().value!;
        const key = periodKey(first.range.start, first.range.end);
        const batch = [...this.pending.entries()].filter(([, c]) => periodKey(c.range.start, c.range.end) === key);
        for (const [id] of batch) this.pending.delete(id);
        try {
          await this.save({ action: "selectMany", range: first.range, updates: batch.map(([, { ingredientId, checked }]) => ({ ingredientId, checked })) });
          const overrides = { ...this.snapshot.overrides };
          for (const [id, value] of batch) if (overrides[id]?.version === value.version) delete overrides[id];
          this.update({ overrides });
        } catch {
          for (const [id, value] of batch) if (!this.pending.has(id)) this.pending.set(id, value);
          this.update({ error: true }); break;
        }
      }
    };
    this.running = work().finally(() => { this.running = null; this.update({ saving: false }); });
    return this.running;
  }
}
