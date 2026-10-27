import { test, expect } from "@playwright/test";
import { NavigationCache, pageWindow, PAGE_SIZE } from "../src/lib/navigation-cache";
import { shoppingNeeds, applyShoppingMutation } from "../src/lib/shopping";
import { demoIngredients, demoRecipes } from "../src/lib/demo-recipes";
import { defaultUnits, addDays } from "../src/lib/units";
import type { ShoppingWorkspace } from "../src/lib/shopping-types";

test("50-result windows cover every result once and clamp after deletion", () => {
  for (const total of [0, 1, 49, 50, 51, 100, 151, 1023]) {
    const seen: number[] = [];
    for (let p = 1; p <= pageWindow(total, 1).pages; p++) {
      const w = pageWindow(total, p);
      expect(w.end - w.start).toBeLessThanOrEqual(PAGE_SIZE);
      seen.push(...Array.from({ length: w.end - w.start }, (_, i) => w.start + i));
    }
    expect(seen).toEqual(Array.from({ length: total }, (_, i) => i));
  }
  expect(pageWindow(50, 3).page).toBe(1);
  expect(pageWindow(101, -10).page).toBe(1);
});

test("navigation calculations reuse a snapshot but never another account or changed stock", () => {
  const a = new NavigationCache(), b = new NavigationCache(), snapshot = {};
  let calls = 0;
  const compute = () => ++calls;
  expect(a.calculate(snapshot, "pantry", compute)).toBe(1);
  expect(a.calculate(snapshot, "pantry", compute)).toBe(1);
  expect(b.calculate(snapshot, "pantry", compute)).toBe(2);
  expect(a.calculate({}, "pantry", compute)).toBe(3);
  a.clear();
  expect(a.calculate(snapshot, "pantry", compute)).toBe(4);
});

test("parallel reads deduplicate, expiration refreshes, errors can retry", async () => {
  const cache = new NavigationCache(); let calls = 0;
  const load = async () => ++calls;
  expect(await Promise.all([cache.read("tags", load), cache.read("tags", load)])).toEqual([1, 1]);
  expect(await cache.read("tags", load)).toBe(1);
  cache.invalidate("tags");
  expect(await cache.read("tags", load, -1)).toBe(2);
  expect(await cache.read("tags", load)).toBe(3);
  await expect(cache.read("failure", async () => { throw Error("offline"); })).rejects.toThrow("offline");
  expect(await cache.read("failure", load)).toBe(4);
});

test("a read begun before a mutation cannot repopulate the cache after invalidation", async () => {
  const cache = new NavigationCache();
  let finish!: (v: number) => void;
  const old = cache.read("learning:day", () => new Promise<number>(r => { finish = r; }));
  await Promise.resolve();
  cache.invalidate("learning:");
  expect(await cache.read("learning:day", async () => 2)).toBe(2);
  finish(1); await old;
  expect(await cache.read("learning:day", async () => 3)).toBe(2);
});

test("pagination keeps reservations for meals beyond page one and refreshes after cooking", () => {
  const recipe = demoRecipes[0], start = "2026-10-26";
  const data: ShoppingWorkspace = {
    plans: [], journal: [], weights: [], documents: [], groceryChecks: [],
    ingredients: demoIngredients, recipes: demoRecipes, preferences: defaultUnits,
    slots: Array.from({length: 60}, (_, i) => ({ date: addDays(start, i), slot: "dinner", recipeId: recipe.id })),
    pantry: [{id:crypto.randomUUID(),ingredientId:"beef-95-raw",name:"Beef",location:"fridge",quantity:{kind:"mass",value:20000},note:"",inStock:true}],
  };
  const cache = new NavigationCache(); let calculations = 0;
  const report = (d: ShoppingWorkspace) => cache.calculate(d, "all", () => { calculations++; return shoppingNeeds(d,d,start,addDays(start,59)); });
  const first = report(data);
  expect(first.meals).toBe(60);
  expect(pageWindow(data.slots.length,1).end).toBe(50);
  expect(report(data)).toBe(first);
  expect(calculations).toBe(1);
  const next = applyShoppingMutation(data, {action:"cook", id:crypto.randomUUID(), meal:data.slots[0], portions:recipe.servings, includeOptional:false}, data);
  expect(report(next)).not.toBe(first);
  expect(report(next).meals).toBe(59);
  expect(calculations).toBe(2);
  expect(data.pantry[0].quantity?.value).toBe(20000);
});
