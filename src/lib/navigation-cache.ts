// Instances belong to one mounted dashboard, never to the server or another account.
export class NavigationCache {
  readonly views = new Map<string, unknown>();
  private snapshots = new WeakMap<object, Map<string, unknown>>();
  private requests = new Map<string, { expires: number; promise: Promise<unknown> }>();

  calculate<T>(snapshot: object, key: string, compute: () => T): T {
    let values = this.snapshots.get(snapshot);
    if (!values) { values = new Map(); this.snapshots.set(snapshot, values); }
    if (values.has(key)) return values.get(key) as T;
    const value = compute();
    if (values.size >= 16) values.delete(values.keys().next().value!);
    values.set(key, value);
    return value;
  }

  read<T>(key: string, load: () => Promise<T>, ttl = 30_000): Promise<T> {
    const found = this.requests.get(key);
    if (found && found.expires > Date.now()) return found.promise as Promise<T>;
    const entry = { expires: Infinity, promise: Promise.resolve().then(load) as Promise<unknown> };
    // Concurrent readers share one request. Failed or invalidated reads are never cached.
    entry.promise = entry.promise.then(value => {
      entry.expires = Date.now() + ttl;
      return value;
    }, error => {
      if (this.requests.get(key) === entry) this.requests.delete(key);
      throw error;
    });
    if (this.requests.size >= 80) this.requests.delete(this.requests.keys().next().value!);
    this.requests.set(key, entry);
    return entry.promise as Promise<T>;
  }

  invalidate(prefix = "") {
    for (const key of this.requests.keys()) if (key.startsWith(prefix)) this.requests.delete(key);
  }
  clear() { this.invalidate(); this.views.clear(); this.snapshots = new WeakMap(); }
}

export const PAGE_SIZE = 50;
export function pageWindow(total: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(requested) || 1));
  const start = (page - 1) * PAGE_SIZE;
  return { page, pages, start, end: Math.min(total, start + PAGE_SIZE), total };
}
