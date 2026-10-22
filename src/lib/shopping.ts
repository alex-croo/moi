import { z } from "zod";
import type { MealSlot, PantryItem, Quantity, RecipeIngredient } from "./types";
import type { ShoppingCatalog, ShoppingPersonal, ShoppingState, PurchaseLine, CookedMeal } from "./shopping-types";
import { addDays } from "./units";
import { grocerCategories, normalizePostalCode, postalCodePattern } from "./grocer-preferences";
import { aisles, suggestedLocation, type ShoppingIngredient } from "./grocery-aisles";
import type { PantryEntry } from "./pantry";
import { countMeasure } from "./ingredient-measures";

const id = z.string().regex(/^[a-z0-9-]{1,100}$/);
const quantity = z.object({ kind: z.enum(["mass", "volume", "spoon", "count"]), value: z.number().finite().min(0).max(1000000), label: z.string().max(80).optional(), labelEn: z.string().max(80).optional() }).strict();
const location = z.enum(["cupboard", "fridge", "freezer", "spices"]);
export const purchaseLineKey = (line: PurchaseLine) => line.id || line.ingredientId!;
const line = z.object({ id: z.uuid().optional(), ingredientId: id.nullable(), name: z.string().trim().min(1).max(160).optional(), quantity, location, personalItemId: z.uuid().optional(), aisle: z.enum(aisles).optional(), purchaseLabel: z.string().trim().max(160).optional(), priceCents: z.number().int().min(0).max(100000000).optional() }).strict().refine(l => l.ingredientId !== null || !!l.id && !!l.name);
const lines = z.array(line).min(1).max(300).refine(v => new Set(v.map(purchaseLineKey)).size === v.length);
const personalItem = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(160), aisle: z.enum(aisles), quantity: quantity.refine(q => q.value > 0) }).strict();
const deliveryWindow = z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timeZone: z.literal("America/Toronto") }).strict().refine(v => v.start < v.end);
const range = z.object({ start: z.iso.date(), end: z.iso.date() }).strict().refine(v => v.start <= v.end && v.end <= addDays(v.start, 90));
const meal = z.object({ date: z.iso.date(), slot: z.enum(["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "evening_snack"]), recipeId: id }).strict();
export const shoppingMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("postalCode"), postalCode: z.string().max(12).transform(normalizePostalCode).refine(v => v === "" || postalCodePattern.test(v)) }).strict(),
  z.object({ action: z.literal("range"), range }).strict(),
  z.object({ action: z.literal("select"), range, ingredientId: id, checked: z.boolean() }).strict(),
  z.object({ action: z.literal("selectMany"), range, updates: z.array(z.object({ ingredientId: id, checked: z.boolean() }).strict()).max(600) }).strict(),
  z.object({ action: z.literal("personalItem"), item: personalItem }).strict(),
  z.object({ action: z.literal("removePersonalItem"), id: z.uuid() }).strict(),
  z.object({ action: z.literal("grocers"), grocers: z.array(z.object({ id: z.uuid(), name: z.string().trim().min(1).max(100), url: z.union([z.literal(""), z.url().max(2048).refine(v => { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password; })]), favorite: z.boolean(), fulfillment: z.enum(["delivery", "pickup"]), categories: z.array(z.enum(grocerCategories)).max(grocerCategories.length).optional() }).strict()).max(20).refine(v => {
    const categories = v.flatMap(g => g.categories || []);
    return new Set(v.map(x => x.id)).size === v.length && v.filter(x => x.favorite).length <= 1 && new Set(categories).size === categories.length;
  }) }).strict(),
  z.object({ action: z.literal("order"), id: z.uuid(), mode: z.enum(["store", "online"]), grocer: z.string().trim().max(100), expectedDate: z.iso.date(), fulfillment: z.enum(["delivery", "pickup"]), lines, deliveryWindow: deliveryWindow.optional() }).strict(),
  z.object({ action: z.literal("receive"), id: z.uuid(), lines }).strict(),
  z.object({ action: z.literal("receiveActual"), id: z.uuid(), lines: z.array(line).max(300).refine(v => new Set(v.map(purchaseLineKey)).size === v.length) }).strict(),
  z.object({ action: z.literal("thaw"), id: z.uuid(), itemId: z.uuid(), amount: z.number().positive().max(1000000) }).strict(),
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
// Bridge dimensions using documented recipe weights and explicit ingredient measures.
function conversion(from: Quantity, need: Need): number | null {
  if (compatible(from, need.quantity)) return 1;
  if (need.grams <= 0 || need.quantity.value <= 0) return null;
  if (from.kind === "mass") return need.quantity.value / need.grams;
  const piece = countMeasure(need.ingredientId, from);
  if (piece) return piece.grams * need.quantity.value / need.grams;
  if (need.quantity.kind === "mass") return null;
  return null;
}
export const mealHours: Record<MealSlot["slot"], string> = { breakfast: "08:00", morning_snack: "10:00", lunch: "12:00", afternoon_snack: "15:00", dinner: "18:00", evening_snack: "21:00" };
export type OrderSource = { id: string; grocer: string; date: string };
type Stock = { source?: OrderSource; time?: string; ingredientId: string | null; quantity: Quantity | null; available: number; date: string; pending: boolean; index: number };
function take(stock: Stock[], need: Need, date: string, time = "23:59") {
  let remaining = need.quantity.value, onHand = 0, pending = 0, check = false, estimated = false;
  const deductions: { index: number; amount: number }[] = [];
  const sources = new Map<string, OrderSource>(), uncertainSources = new Map<string, OrderSource>();
  let pendingCheck = false;
  for (const entry of stock) {
    if (entry.ingredientId !== need.ingredientId || entry.date > date || entry.date === date && (entry.time || "00:00") > time) continue;
    if (!entry.quantity) { check = true; continue; }
    const factor = conversion(entry.quantity, need);
    if (factor === null) {
      if (entry.available > 0 && remaining > 1e-8) { check = true; if (entry.source) { pendingCheck = true; uncertainSources.set(entry.source.id, entry.source); } }
      continue;
    }
    if (remaining <= 1e-8 || entry.available <= 1e-8) continue;
    const used = Math.min(remaining, entry.available * factor);
    entry.available = clean(entry.available - used / factor);
    remaining = clean(remaining - used);
    if (entry.pending) { pending += used; if (entry.source) sources.set(entry.source.id, entry.source); } else onHand += used;
    deductions.push({ index: entry.index, amount: used / factor });
    estimated ||= !compatible(entry.quantity, need.quantity);
  }
  if (remaining > 1e-8) for (const source of uncertainSources.values()) sources.set(source.id, source);
  return { remaining, onHand, pending, check: check && remaining > 1e-8, pendingCheck: pendingCheck && remaining > 1e-8, estimated, deductions, sources: [...sources.values()] };
}
function stockFrom(pantry: PantryItem[]): Stock[] {
  return pantry.map((p, index) => ({ ingredientId: p.ingredientId, quantity: p.quantity, available: p.inStock ? p.quantity?.value || 0 : 0, date: "0000-01-01", pending: false, index }))
    .filter((_, index) => pantry[index].inStock)
    .sort((a, b) => Number(pantry[a.index].location === "freezer") - Number(pantry[b.index].location === "freezer"));
}
export type ShoppingItem = {
  ingredient: ShoppingIngredient; personalItemId?: string; quantity: Quantity; required: number; onHand: number; pending: number;
  sources: OrderSource[]; awaitingConfirmation: number;
  estimated: boolean; needsStockCheck: boolean; uses: { recipe: ShoppingCatalog["recipes"][number]; meals: number }[];
};
export type MealAvailability = {
  meal: MealSlot; sources: OrderSource[]; complete: boolean;
  missing: { ingredientId: string; quantity: Quantity; check: boolean }[];
  frozen: { itemId: string; ingredientId: string; quantity: Quantity }[];
};
export const toBuyQuantity = (item: ShoppingItem) => ({ ...item.quantity, value: clean(item.quantity.value - item.awaitingConfirmation) });
export function shoppingPurchaseLine(item: ShoppingItem): PurchaseLine {
  return { ingredientId: item.personalItemId ? null : item.ingredient.id,
    ...(item.personalItemId ? { id: item.personalItemId, personalItemId: item.personalItemId, name: item.ingredient.name, aisle: item.ingredient.aisle } : {}),
    quantity: { ...item.quantity }, location: suggestedLocation(item.ingredient) };
}
export function shoppingNeeds(data: ShoppingPersonal, catalog: ShoppingCatalog, start: string, end: string, includeOptional = false) {
  const state = shoppingState(data), stock = stockFrom(data.pantry);
  for (const order of state.orders.filter(o => o.status === "pending").sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)))
    for (const line of order.lines) stock.push({ ingredientId: line.ingredientId, quantity: line.quantity, available: line.quantity.value, date: order.expectedDate, time: order.deliveryWindow?.end, source: { id: order.id, grocer: order.grocer, date: order.expectedDate }, pending: true, index: -1 });
  const result = new Map<string, ShoppingItem>();
  const grams = new Map<string, { required: number; remaining: number; onHand: number; pending: number; awaitingConfirmation: number }>();
  const availability: Record<string, MealAvailability> = {};
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
    const report: MealAvailability = { meal: slot, sources: [], complete: true, missing: [], frozen: [] };
    availability[mealKey(slot)] = report;
    const seen = new Set<string>();
    for (const line of recipe.ingredients) {
      if (line.optional && !includeOptional || line.ingredientId === "eau") continue;
      const ingredient = catalog.ingredients.find(i => i.id === line.ingredientId);
      if (!ingredient) { if (visible) missing++; report.complete = false; report.missing.push({ ingredientId: line.ingredientId, quantity: line.quantity, check: true }); continue; }
      const allocation = take(stock, demand(line), slot.date, mealHours[slot.slot]);
      for (const source of allocation.sources) if (!report.sources.some(s => s.id === source.id)) report.sources.push(source);
      if (allocation.remaining > 1e-8) { report.complete = false; report.missing.push({ ingredientId: ingredient.id, quantity: { ...line.quantity, value: allocation.remaining }, check: allocation.check }); }
      for (const d of allocation.deductions) {
        const item = data.pantry[d.index];
        if (item?.location === "freezer" && item.quantity) report.frozen.push({ itemId: item.id, ingredientId: ingredient.id, quantity: { ...item.quantity, value: d.amount } });
      }
      if (!visible) continue;
      let item = result.get(ingredient.id);
      if (!item) {
        item = { ingredient, quantity: { ...line.quantity, value: 0 }, required: 0, onHand: 0, pending: 0, estimated: false, needsStockCheck: false, awaitingConfirmation: 0, sources: [], uses: [] };
        result.set(ingredient.id, item);
      }
      // Keep a single canonical row; mixed recipe units use their gram equivalents.
      if (!compatible(item.quantity, line.quantity)) {
        if (item.quantity.kind !== "mass") {
          const totals = grams.get(ingredient.id)!;
          item.quantity = { kind: "mass", value: totals.remaining };
          item.required = totals.required; item.onHand = totals.onHand; item.pending = totals.pending; item.awaitingConfirmation = totals.awaitingConfirmation;
        }
        item.estimated = true;
      }
      const factor = compatible(item.quantity, line.quantity) ? 1 : line.quantity.value > 0 ? line.grams / line.quantity.value : 0;
      item.quantity.value = clean(item.quantity.value + allocation.remaining * factor);
      item.required += line.quantity.value * factor; item.onHand += allocation.onHand * factor; item.pending += allocation.pending * factor;
      item.estimated ||= allocation.estimated;
      item.needsStockCheck ||= allocation.check;
      item.awaitingConfirmation = clean(item.awaitingConfirmation + (allocation.pendingCheck ? allocation.remaining * factor : 0));
      for (const source of allocation.sources) if (!item.sources.some(s => s.id === source.id)) item.sources.push(source);
      const prior = grams.get(ingredient.id) || { required: 0, remaining: 0, onHand: 0, pending: 0, awaitingConfirmation: 0 };
      const g = line.quantity.value > 0 ? line.grams / line.quantity.value : 0;
      grams.set(ingredient.id, { required: prior.required + line.grams, remaining: prior.remaining + allocation.remaining * g, onHand: prior.onHand + allocation.onHand * g, pending: prior.pending + allocation.pending * g, awaitingConfirmation: prior.awaitingConfirmation + (allocation.pendingCheck ? allocation.remaining * g : 0) });
      if (!seen.has(ingredient.id)) {
        const use = item.uses.find(u => u.recipe.id === recipe.id);
        if (use) use.meals++; else item.uses.push({ recipe, meals: 1 });
        seen.add(ingredient.id);
      }
    }
  }
  // Personal purchases are a to-buy intention, not a recipe demand. They remain
  // visible across date ranges; receiving them never reserves the same pantry twice.
  for (const personal of state.personalItems || []) {
    let received = 0, pending = 0;
    const sources: OrderSource[] = [];
    for (const order of state.orders) {
      if (order.status === "cancelled") continue;
      const matched = (order.status === "received" ? order.received || order.lines : order.lines)
        .filter(l => l.personalItemId === personal.id && compatible(l.quantity, personal.quantity));
      const amount = matched.reduce((sum, l) => sum + l.quantity.value, 0);
      if (order.status === "received") received += amount;
      else if (amount > 0) { pending += amount; sources.push({ id: order.id, grocer: order.grocer, date: order.expectedDate }); }
    }
    result.set(personal.id, {
      personalItemId: personal.id, ingredient: { id: personal.id, name: personal.name, nameEn: personal.name, aisle: personal.aisle },
      quantity: { ...personal.quantity, value: clean(personal.quantity.value - received - pending) },
      required: personal.quantity.value, onHand: Math.min(received, personal.quantity.value), pending,
      sources, awaitingConfirmation: 0, estimated: false, needsStockCheck: false, uses: [],
    });
  }
  return { items: [...result.values()], meals, missing, availability };
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
function addStock(pantry: PantryEntry[], line: PurchaseLine, catalog: ShoppingCatalog) {
  if (line.quantity.value <= 0) return;
  const existing = pantry.find(p => p.ingredientId === line.ingredientId && (line.ingredientId !== null || p.name === line.name) && p.location === line.location && p.quantity && compatible(p.quantity, line.quantity));
  if (existing?.quantity) {
    existing.quantity.value = clean((existing.inStock ? existing.quantity.value : 0) + line.quantity.value); existing.inStock = true; if (line.aisle) existing.aisle = line.aisle;
  } else pantry.push({ id: crypto.randomUUID(), ingredientId: line.ingredientId, name: catalog.ingredients.find(i => i.id === line.ingredientId)?.name || line.name || line.ingredientId!, location: line.location, quantity: { ...line.quantity }, inStock: true, ...(line.aisle ? { aisle: line.aisle } : {}), note: line.purchaseLabel || "" });
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
    case "selectMany": {
      const key = periodKey(input.range.start, input.range.end), selected = new Set(state.selections[key] || []);
      for (const update of input.updates) update.checked ? selected.add(update.ingredientId) : selected.delete(update.ingredientId);
      state.selections[key] = [...selected];
      break;
    }
    case "personalItem": {
      const previous = state.personalItems || [];
      if (previous.some(i => i.id === input.item.id)) return data;
      if (previous.length >= 500) throw Error("personal_list_full");
      state.personalItems = [...previous, input.item];
      break;
    }
    case "removePersonalItem": {
      state.personalItems = (state.personalItems || []).filter(i => i.id !== input.id);
      for (const key of Object.keys(state.selections)) state.selections[key] = state.selections[key].filter(id => id !== input.id);
      break;
    }
    case "grocers": state.grocers = input.grocers; break;
    case "order": {
      if (state.orders.some(o => o.id === input.id)) return data;
      if (input.lines.some(l => l.ingredientId !== null && !catalog.ingredients.some(i => i.id === l.ingredientId)) || !input.lines.some(l => l.quantity.value > 0)) throw Error("invalid_order");
      for (const line of input.lines) if (line.personalItemId) {
        const item = state.personalItems?.find(i => i.id === line.personalItemId);
        if (!item || line.ingredientId !== null || !compatible(item.quantity, line.quantity)) throw Error("invalid_personal_item");
        // Use the user's saved identity and aisle, not arbitrary receipt metadata.
        line.name = item.name; line.aisle = item.aisle;
      }
      const purchase = { ...input, status: input.mode === "store" ? "received" as const : "pending" as const, createdAt: now };
      state.orders.unshift({ id: purchase.id, mode: purchase.mode, grocer: purchase.grocer, expectedDate: purchase.expectedDate, fulfillment: purchase.fulfillment, lines: purchase.lines, status: purchase.status, createdAt: now,
        ...(input.deliveryWindow ? { deliveryWindow: input.deliveryWindow } : {}), ...(input.mode === "store" ? { received: input.lines, receivedAt: now } : {}) });
      if (input.mode === "store") for (const line of input.lines) addStock(next.pantry, line, catalog);
      for (const key of Object.keys(state.selections)) state.selections[key] = state.selections[key].filter(id => !input.lines.some(l => (l.ingredientId === id || l.personalItemId === id) && l.quantity.value > 0));
      break;
    }
    case "receive": case "receiveActual": {
      const order = state.orders.find(o => o.id === input.id);
      if (!order || order.status === "cancelled") throw Error("order_unavailable");
      if (order.status === "received") return data;
      if (input.action === "receive" && (input.lines.length !== order.lines.length || input.lines.some(l => !order.lines.some(original => purchaseLineKey(original) === purchaseLineKey(l) && original.ingredientId === l.ingredientId && compatible(original.quantity, l.quantity))))) throw Error("invalid_receipt");
      if (input.lines.some(l => l.ingredientId !== null && !catalog.ingredients.some(i => i.id === l.ingredientId))) throw Error("invalid_receipt");
      // A reviewed receipt can contain substitutions, extras and missing products.
      // Keep the ordered lines untouched; only confirmed received lines enter stock.
      const received = input.action === "receive" ? input.lines.map(l => ({ ...order.lines.find(original => purchaseLineKey(original) === purchaseLineKey(l))!, quantity: l.quantity, location: l.location })) : input.lines.map(l => {
        if (l.personalItemId && !order.lines.some(original => original.personalItemId === l.personalItemId && original.ingredientId === l.ingredientId && compatible(original.quantity, l.quantity))) throw Error("invalid_personal_item");
        return { ...l };
      });
      for (const line of received) addStock(next.pantry, line, catalog);
      order.status = "received"; order.received = received; order.receivedAt = now;
      break;
    }
    case "thaw": {
      if (state.thawed?.includes(input.id)) return data;
      const item = next.pantry.find(p => p.id === input.itemId);
      if (!item || !item.inStock || item.location !== "freezer" || !item.quantity || input.amount > item.quantity.value) throw Error("frozen_stock_changed");
      const moved = { ...item.quantity, value: input.amount };
      item.quantity.value = clean(item.quantity.value - input.amount); item.inStock = item.quantity.value > 0;
      addStock(next.pantry, { ingredientId: item.ingredientId, name: item.name, quantity: moved, location: "fridge", purchaseLabel: item.note, aisle: (item as PantryEntry).aisle }, catalog);
      state.thawed = [...(state.thawed || []), input.id];
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
