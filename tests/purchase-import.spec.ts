import { test, expect } from "@playwright/test";
import { applyShoppingMutation, shoppingMutation, shoppingNeeds } from "../src/lib/shopping";
import { demoData } from "../src/lib/demo";
import type { ShoppingWorkspace, PurchaseLine } from "../src/lib/shopping-types";

test("imported products retain packaging, prices and delivery window; receipt adds each format once", () => {
  const lines: PurchaseLine[] = [
    { id: crypto.randomUUID(), ingredientId: "beef-95-raw", name: "Brand A", purchaseLabel: "2 × 250 g", priceCents: 1299, location: "fridge", quantity: { kind: "mass", value: 500 } },
    { id: crypto.randomUUID(), ingredientId: "beef-95-raw", name: "Brand B", priceCents: 599, location: "fridge", quantity: { kind: "mass", value: 200 } },
    { id: crypto.randomUUID(), ingredientId: null, name: "Custard tarts", location: "fridge", quantity: { kind: "count", value: 6, label: "pièces" } },
    { id: crypto.randomUUID(), ingredientId: null, name: "Cookies", location: "fridge", quantity: { kind: "count", value: 6, label: "pièces" } },
    { id: crypto.randomUUID(), ingredientId: "onion-raw", name: "Onions, bag size unspecified", location: "cupboard", quantity: { kind: "count", value: 1, label: "sacs" } },
  ];
  const initial: ShoppingWorkspace = { ...demoData, pantry: [], slots: [{ date: "2026-10-24", slot: "dinner", recipeId: demoData.recipes[0].id }] };
  const request = { action: "order", id: crypto.randomUUID(), mode: "online", grocer: "Example grocer", expectedDate: "2026-10-23", fulfillment: "delivery", deliveryWindow: { start: "17:30", end: "20:30", timeZone: "America/Toronto" }, lines };
  const pending = applyShoppingMutation(initial, request, initial);
  expect(pending.pantry).toHaveLength(0);
  expect(pending.shopping!.orders[0].deliveryWindow).toEqual(request.deliveryWindow);
  expect(pending.shopping!.orders[0].lines).toEqual(lines);
  expect(shoppingNeeds(pending, initial, "2026-10-24", "2026-10-24").items.find(i => i.ingredient.id === "onion-raw")).toMatchObject({ needsStockCheck: true, quantity: { value: 100 } });
  const receipt = { action: "receive", id: request.id, lines: [...lines].reverse().map(l => ({ ...l, priceCents: 1, name: "Changed during receipt" })) };
  const received = applyShoppingMutation(pending, receipt, initial);
  expect(received.pantry.find(i => i.ingredientId === "beef-95-raw")?.quantity?.value).toBe(700);
  expect(received.pantry.filter(i => i.ingredientId === null).map(i => i.name).sort()).toEqual(["Cookies", "Custard tarts"]);
  expect(received.shopping!.orders[0].received!.find(l => l.id === lines[0].id)?.priceCents).toBe(1299);
  expect(applyShoppingMutation(received, receipt, initial)).toBe(received);
  expect(() => applyShoppingMutation(pending, { ...receipt, lines: [lines[0], lines[0], ...lines.slice(2)] }, initial)).toThrow();
  expect(() => applyShoppingMutation(pending, { ...receipt, lines: lines.map((l, i) => i === 0 ? { ...l, id: crypto.randomUUID() } : l) }, initial)).toThrow();
  expect(() => applyShoppingMutation(pending, { ...receipt, lines: lines.map((l, i) => i === 0 ? { ...l, ingredientId: "onion-raw" } : l) }, initial)).toThrow();
  expect(initial.pantry).toHaveLength(0);
});

test("import rejects missing product identities and invalid delivery hours", () => {
  const base = { action: "order", id: crypto.randomUUID(), mode: "online", grocer: "Example", expectedDate: "2026-10-23", fulfillment: "delivery", lines: [{ ingredientId: null, quantity: { kind: "count", value: 1 }, location: "cupboard" }] };
  expect(shoppingMutation.safeParse(base).success).toBe(false);
  const valid = { ...base, lines: [{ ...base.lines[0], id: crypto.randomUUID(), name: "Custom food" }] };
  expect(shoppingMutation.safeParse(valid).success).toBe(true);
  for (const [start, end] of [["25:00", "26:00"], ["20:30", "17:30"], ["17:30", "17:30"]])
    expect(shoppingMutation.safeParse({ ...valid, deliveryWindow: { start, end, timeZone: "America/Toronto" } }).success).toBe(false);
});
