import { z } from "zod";
import type { MealSlot, PantryItem, Quantity, RecipeIngredient } from "./types";
import type { ShoppingCatalog, ShoppingPersonal, ShoppingState, PurchaseLine, CookedMeal } from "./shopping-types";
import { addDays } from "./units";
import { grocerCategories, normalizePostalCode, postalCodePattern } from "./grocer-preferences";

const id = z.string().regex(/^[a-z0-9-]{1,100}$/);
const quantity = z.object({ kind: z.enum(["mass", "volume", "spoon", "count"]), value: z.number().finite().min(0).max(1000000), label: z.string().max(80).optional(), labelEn: z.string().max(80).optional() }).strict();
const location = z.enum(["cupboard", "fridge", "freezer", "spices"]);
const line = z.object({ ingredientId: id, quantity, location }).strict();
const lines = z.array(line).min(1).max(300).refine(v => new Set(v.map(x => x.ingredientId)).size === v.length);
const range = z.object({ start: z.iso.date(), end: z.iso.date() }).strict().refine(v => v.start <= v.end && v.end <= addDays(v.start, 90));
const meal = z.object({ date: z.iso.date(), slot: z.enum(["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "evening_snack"]), recipeId: id }).strict();
export const shoppingMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("postalCode"), postalCode: z.string().max(12).transform(normalizePostalCode).refine(v => v === "" || postalCodePattern.test(v)) }).strict(),
  z.object({ action: z.literal("range"), range }).strict(),
  z.object({ action: z.literal("select"), range, ingredientId: id, checked: z.boolean() }).strict(),
  z.object({ action: z.literal("grocers"), grocers: z.array(z.object({ id: z.uuid(), name: z.string().trim().min(1).max(100), url: z.union([z.literal(""), z.url().max(2048).refine(v => { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password; })]), favorite: z.boolean(), fulfillment: z.enum(["delivery", "pickup"]), categories: z.array(z.enum(grocerCategories)).max(grocerCategories.length).optional() }).strict()).max(20).refine(v => {
    const categories = v.flatMap(g => g.categories || []);
    return new Set(v.map(x => x.id)).size === v.length && v.filter(x => x.favorite).length <= 1 && new Set(categories).size === categories.length;
  }) }).strict(),
  z.object({ action: z.literal("order"), id: z.uuid(), mode: z.enum(["store", "online"]), grocer: z.string().trim().max(100), expectedDate: z.iso.date(), fulfillment: z.enum(["delivery", "pickup"]), lines }).strict(),
  z.object({ action: z.literal("receive"), id: z.uuid(), lines }).strict(),
  z.object({ action: z.literal("cancel"), id: z.uuid() }).strict(),
  z.object({ action: z.literal("reschedule"), id: z.uuid(), expectedDate: z.iso.date() }).strict(),
  z.object({ action: z.literal("cook"), id: z.uuid(), meal, portions: z.number().positive().max(100), includeOptional: z.boolean() }).strict(),
  z.object({ action: z.literal("undoCook"), id: z.uuid() }).strict(),
]);
export type ShoppingMutation = z.infer<typeof shoppingMutation>;
export const periodKey = (start: string, end: string) => `${start}:${end}`;
export const mealKey = (s: MealSlot) => `${s.date}:${s.slot}:${s.recipeId}`;
export function shoppingState(data: ShoppingPersonal): ShoppingState {
  if (data.shopping) return data.shopping;
  const selections: Record<string, string[]> = {};
  for (const check of data.groceryChecks || []) if (check.checked) {
    const key = periodKey(check.week, addDays(check.week, 6));
    selections[key] = [...new Set([...(selections[key] || []), check.ingredientId])];
  }
  return { grocers: [], orders: [], cooked: [], selections };
}
const clean = (n: number) => Math.max(0, Math.round(n * 1e8) / 1e8);
const volume = (q: Quantity) => q.kind === "volume" || q.kind === "spoon";
export function compatible(a: Quantity, b: Quantity) {
  return volume(a) && volume(b) || a.kind === b.kind && (a.kind !== "count" || (a.label || "") === (b.label || "") && (a.labelEn || "") === (b.labelEn || ""));
}
type Need = { ingredientId: string; quantity: Quantity; grams: number };
function demand(line: RecipeIngredient, factor = 1): Need {
  return { ingredientId: line.ingredientId, quantity: { ...line.quantity, value: line.quantity.value * factor }, grams: line.grams * factor };
}
// Only a recipe's documented gram equivalent can bridge incompatible dimensions.
function conversion(from: Quantity, need: Need): number | null {
  if (compatible(from, need.quantity)) return 1;
  if (need.grams <= 0 || need.quantity.value <= 0) return null;
  if (from.kind === "mass") return need.quantity.value / need.grams;
  if (need.quantity.kind === "mass") return null;
  return null;
}
type Stock = { ingredientId: string | null; quantity: Quantity | null; available: number; date: string; pending: boolean; index: number };
function take(stock: Stock[], need: Need, date: string) {
  let remaining = need.quantity.value, onHand = 0, pending = 0, check = false, estimated = false;
  const deductions: { index: number; amount: number }[] = [];
  for (const entry of stock) {
    if (entry.ingredientId !== need.ingredientId || entry.date > date) continue;
    if (!entry.quantity) { check = true; continue; }
    const factor = conversion(entry.quantity, need);
    if (factor === null) { if (entry.available > 0) check = true; continue; }
    if (remaining <= 1e-8 || entry.available <= 1e-8) continue;
    const used = Math.min(remaining, entry.available * factor);
    entry.available = clean(entry.available - used / factor);
    remaining = clean(remaining - used);
    if (entry.pending) pending += used; else onHand += used;
    deductions.push({ index: entry.index, amount: used / factor });
    estimated ||= factor !== 1;
  }
  return { remaining, onHand, pending, check, estimated, deductions };
}
function stockFrom(pantry: PantryItem[]): Stock[] {
  return pantry.map((p, index) => ({ ingredientId: p.ingredientId, quantity: p.quantity, available: p.inStock ? p.quantity?.value || 0 : 0, date: "0000-01-01", pending: false, index }))
    .filter((_, index) => pantry[index].inStock);
}
export type ShoppingItem = {
  ingredient: ShoppingCatalog["ingredients"][number]; quantity: Quantity; required: number; onHand: number; pending: number;
  estimated: boolean; needsStockCheck: boolean; uses: { recipe: ShoppingCatalog["recipes"][number]; meals: number }[];
};
export function shoppingNeeds(data: ShoppingPersonal, catalog: ShoppingCatalog, start: string, end: string, includeOptional = false) {
  const state = shoppingState(data), stock = stockFrom(data.pantry);
  for (const order of state.orders.filter(o => o.status === "pending").sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)))
    for (const line of order.lines) stock.push({ ingredientId: line.ingredientId, quantity: line.quantity, available: line.quantity.value, date: order.expectedDate, pending: true, index: -1 });
  const result = new Map<string, ShoppingItem>();
  const grams = new Map<string, { required: number; remaining: number; onHand: number; pending: number }>();
  let meals = 0, missing = 0;
  // Allocate across all unfinished meals, including those before this period.
  // Changing the visible dates must not reserve the same stock twice.
  const slots = data.slots.filter(s => s.date <= end && !state.cooked.some(c => !c.undone && mealKey(c.meal) === mealKey(s)))
    .sort((a, b) => a.date.localeCompare(b.date) || timeOrder(a.slot) - timeOrder(b.slot));
  for (const slot of slots) {
    const visible = slot.date >= start;
    const recipe = catalog.recipes.find(r => r.id === slot.recipeId);
    if (!recipe) { if (visible) missing++; continue; }
    if (visible) meals++;
    const seen = new Set<string>();
    for (const line of recipe.ingredients) {
      if (line.optional && !includeOptional || line.ingredientId === "eau") continue;
      const ingredient = catalog.ingredients.find(i => i.id === line.ingredientId);
      if (!ingredient) { if (visible) missing++; continue; }
      const allocation = take(stock, demand(line), slot.date);
      if (!visible) continue;
      let item = result.get(ingredient.id);
      if (!item) {
        item = { ingredient, quantity: { ...line.quantity, value: 0 }, required: 0, onHand: 0, pending: 0, estimated: false, needsStockCheck: false, uses: [] };
        result.set(ingredient.id, item);
      }
      // Keep a single canonical row; mixed recipe units use their gram equivalents.
      if (!compatible(item.quantity, line.quantity)) {
        if (item.quantity.kind !== "mass") {
          const totals = grams.get(ingredient.id)!;
          item.quantity = { kind: "mass", value: totals.remaining };
          item.required = totals.required; item.onHand = totals.onHand; item.pending = totals.pending;
        }
        item.estimated = true;
      }
      const factor = compatible(item.quantity, line.quantity) ? 1 : line.quantity.value > 0 ? line.grams / line.quantity.value : 0;
      item.quantity.value = clean(item.quantity.value + allocation.remaining * factor);
      item.required += line.quantity.value * factor; item.onHand += allocation.onHand * factor; item.pending += allocation.pending * factor;
      item.estimated ||= allocation.estimated;
      item.needsStockCheck ||= allocation.check;
      const prior = grams.get(ingredient.id) || { required: 0, remaining: 0, onHand: 0, pending: 0 };
      const g = line.quantity.value > 0 ? line.grams / line.quantity.value : 0;
      grams.set(ingredient.id, { required: prior.required + line.grams, remaining: prior.remaining + allocation.remaining * g, onHand: prior.onHand + allocation.onHand * g, pending: prior.pending + allocation.pending * g });
      if (!seen.has(ingredient.id)) {
        const use = item.uses.find(u => u.recipe.id === recipe.id);
        if (use) use.meals++; else item.uses.push({ recipe, meals: 1 });
        seen.add(ingredient.id);
      }
    }
  }
  return { items: [...result.values()], meals, missing };
}
function timeOrder(slot: MealSlot["slot"]) { return ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "evening_snack"].indexOf(slot); }
export function previewCooking(data: ShoppingPersonal, catalog: ShoppingCatalog, meal: MealSlot, portions: number, includeOptional: boolean) {
  const recipe = catalog.recipes.find(r => r.id === meal.recipeId);
  if (!recipe) throw Error("recipe_missing");
  const stock = stockFrom(data.pantry), deductions: CookedMeal["deductions"] = [], missing: CookedMeal["missing"] = [];
  for (const line of recipe.ingredients) {
    if (line.optional && !includeOptional || line.ingredientId === "eau") continue;
    const need = demand(line, portions / recipe.servings), result = take(stock, need, meal.date);
    for (const d of result.deductions) deductions.push({ item: structuredClone(data.pantry[d.index]), amount: d.amount });
    if (result.remaining > 1e-8) missing.push({ ingredientId: line.ingredientId, quantity: { ...need.quantity, value: result.remaining } });
  }
  return { deductions, missing };
}
function addStock(pantry: PantryItem[], line: PurchaseLine, catalog: ShoppingCatalog) {
  if (line.quantity.value <= 0) return;
  const existing = pantry.find(p => p.ingredientId === line.ingredientId && p.location === line.location && p.quantity && compatible(p.quantity, line.quantity));
  if (existing?.quantity) {
    existing.quantity.value = clean((existing.inStock ? existing.quantity.value : 0) + line.quantity.value); existing.inStock = true;
  } else pantry.push({ id: crypto.randomUUID(), ingredientId: line.ingredientId, name: catalog.ingredients.find(i => i.id === line.ingredientId)?.name || line.ingredientId, location: line.location, quantity: { ...line.quantity }, inStock: true, note: "" });
}
export function applyShoppingMutation<T extends ShoppingPersonal>(data: T, value: object, catalog: ShoppingCatalog): T {
  const input = shoppingMutation.parse(value), state = structuredClone(shoppingState(data));
  const next = { ...data, shopping: state, pantry: structuredClone(data.pantry) };
  const now = new Date().toISOString();
  switch (input.action) {
    case "postalCode": state.postalCode = input.postalCode; break;
    case "range": state.range = input.range; break;
    case "select": {
      const key = periodKey(input.range.start, input.range.end), selected = state.selections[key] || [];
      state.selections[key] = input.checked ? [...new Set([...selected, input.ingredientId])] : selected.filter(i => i !== input.ingredientId);
      break;
    }
    case "grocers": state.grocers = input.grocers; break;
    case "order": {
      if (state.orders.some(o => o.id === input.id)) return data;
      if (input.lines.some(l => !catalog.ingredients.some(i => i.id === l.ingredientId)) || !input.lines.some(l => l.quantity.value > 0)) throw Error("invalid_order");
      const purchase = { ...input, status: input.mode === "store" ? "received" as const : "pending" as const, createdAt: now };
      state.orders.unshift({ id: purchase.id, mode: purchase.mode, grocer: purchase.grocer, expectedDate: purchase.expectedDate, fulfillment: purchase.fulfillment, lines: purchase.lines, status: purchase.status, createdAt: now,
        ...(input.mode === "store" ? { received: input.lines, receivedAt: now } : {}) });
      if (input.mode === "store") for (const line of input.lines) addStock(next.pantry, line, catalog);
      for (const key of Object.keys(state.selections)) state.selections[key] = state.selections[key].filter(id => !input.lines.some(l => l.ingredientId === id));
      break;
    }
    case "receive": {
      const order = state.orders.find(o => o.id === input.id);
      if (!order || order.status === "cancelled") throw Error("order_unavailable");
      if (order.status === "received") return data;
      if (input.lines.length !== order.lines.length || input.lines.some(l => !order.lines.some(original => original.ingredientId === l.ingredientId && compatible(original.quantity, l.quantity)))) throw Error("invalid_receipt");
      for (const line of input.lines) addStock(next.pantry, line, catalog);
      order.status = "received"; order.received = input.lines; order.receivedAt = now;
      break;
    }
    case "cancel": case "reschedule": {
      const order = state.orders.find(o => o.id === input.id);
      if (!order || order.status !== "pending") throw Error("order_unavailable");
      if (input.action === "cancel") order.status = "cancelled"; else order.expectedDate = input.expectedDate;
      break;
    }
    case "cook": {
      if (state.cooked.some(c => c.id === input.id || !c.undone && mealKey(c.meal) === mealKey(input.meal))) return data;
      if (!data.slots.some(s => mealKey(s) === mealKey(input.meal))) throw Error("meal_changed");
      const result = previewCooking(data, catalog, input.meal, input.portions, input.includeOptional);
      for (const d of result.deductions) {
        const item = next.pantry.find(p => p.id === d.item.id)!;
        item.quantity!.value = clean(item.quantity!.value - d.amount);
        item.inStock = item.quantity!.value > 0;
      }
      state.cooked.push({ id: input.id, meal: input.meal, portions: input.portions, at: now, ...result });
      break;
    }
    case "undoCook": {
      const record = state.cooked.find(c => c.id === input.id);
      if (!record || record.undone) return data;
      for (const d of record.deductions) {
        const current = next.pantry.find(p => p.id === d.item.id);
        if (current?.quantity && compatible(current.quantity, d.item.quantity!) && current.ingredientId === d.item.ingredientId) {
          current.quantity.value = clean((current.inStock ? current.quantity.value : 0) + d.amount); current.inStock = true;
        } else addStock(next.pantry, { ingredientId: d.item.ingredientId!, quantity: { ...d.item.quantity!, value: d.amount }, location: d.item.location }, catalog);
      }
      record.undone = true;
      break;
    }
  }
  return next;
}
