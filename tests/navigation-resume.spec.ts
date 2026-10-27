import { test, expect } from "@playwright/test";
import { NavigationCache } from "../src/lib/navigation-cache";
import { navigationStorageKey, readNavigation } from "../src/lib/navigation-preferences";

function device() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
test("reopening restores section, filters, pagination, dates and scroll for that account only", () => {
  const storage = device(), first = new NavigationCache();
  first.restore("one", storage);
  const state = { section: "pantry", "pantry:query": "ail", "pantry:filter": "freezer", "scroll:pantry": 1422, "page:pantry": { filter: '["ail","freezer"]', page: 2 }, "journal:screen": "editor", "journal:date": "2026-10-27", "journal:tabs": ["2026-10-26", "2026-10-27"], "menus:week": "2026-10-26", "groceries:filter": "pending" };
  for (const [key, value] of Object.entries(state)) first.remember(key, value);
  first.clear();
  const reopened = new NavigationCache(); reopened.restore("one", storage);
  expect(Object.fromEntries(reopened.views)).toEqual(state);
  const another = new NavigationCache(); another.restore("two", storage);
  expect(another.views.size).toBe(0);
  another.remember("section", "recipes");
  expect(storage.values.get(navigationStorageKey("one"))).toContain("pantry");
});
test("only validated navigation is persisted, never private resources or drafts", async () => {
  const storage = device(), cache = new NavigationCache(); cache.restore("one", storage);
  await cache.read("journal", async () => ({ text: "PRIVATE CONTENT" }));
  cache.calculate({}, "personal", () => ({ weight: "PRIVATE CONTENT" }));
  cache.remember("journal:draft", { text: "PRIVATE CONTENT" });
  cache.remember("section", "not-a-section"); cache.remember("scroll:pantry", -2);
  cache.remember("page:recipes", { page: 2, filter: "", injected: "PRIVATE CONTENT" });
  const raw = storage.values.get(navigationStorageKey("one"))!;
  expect(raw).not.toContain("PRIVATE CONTENT"); expect(readNavigation(raw)).toEqual([]);
  expect(readNavigation('{broken')).toEqual([]);
  expect(readNavigation(JSON.stringify({ version: 99, entries: [["section", "recipes"]] }))).toEqual([]);
});
test("blocked device storage does not prevent navigation", () => {
  const cache = new NavigationCache();
  cache.restore("one", { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); } });
  expect(() => cache.remember("section", "recipes")).not.toThrow();
  expect(cache.views.get("section")).toBe("recipes");
});
