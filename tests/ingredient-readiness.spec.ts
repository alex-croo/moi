import { test, expect } from "@playwright/test";
import { applyShoppingMutation, shoppingNeeds, mealKey, toBuyQuantity } from "../src/lib/shopping";
import { thawReminders, mealInstant } from "../src/lib/thaw-reminders";
import { demoData } from "../src/lib/demo";
import { addDays, localToday } from "../src/lib/units";
import type { ShoppingWorkspace } from "../src/lib/shopping-types";
const day = "2026-10-24", id = () => crypto.randomUUID();
function base(): ShoppingWorkspace { return { ...demoData, pantry: [], slots: [{ date: day, slot: "lunch", recipeId: demoData.recipes[0].id }], shopping: undefined }; }
const line = (ingredientId: string, value: number) => ({ ingredientId, quantity: { kind: "mass", value }, location: "fridge" });
function order(data: ShoppingWorkspace, lines: object[], date = "2026-10-23", window?: object) { return applyShoppingMutation(data, { action: "order", id: id(), mode: "online", grocer: "Tre’dish", expectedDate: date, fulfillment: "delivery", lines, ...(window ? { deliveryWindow: window } : {}) }, data); }

test("coverage names only actual orders, reserves stock once, and never promises late or uncertain quantities", () => {
  let data = base();
  data = order(data, [line("beef-95-raw", 500)]);
  let result = shoppingNeeds(data, data, day, day), report = result.availability[mealKey(data.slots[0])];
  expect(report.complete).toBe(false); expect(report.missing.map(i => i.ingredientId)).toEqual(["onion-raw"]);
  expect(result.items.find(i => i.ingredient.id === "onion-raw")!.sources).toEqual([]);
  expect(result.items.find(i => i.ingredient.id === "beef-95-raw")!.sources[0].grocer).toBe("Tre’dish");
  data = order(data, [line("onion-raw", 100)]);
  expect(shoppingNeeds(data, data, day, day).availability[mealKey(data.slots[0])].complete).toBe(true);
  data.slots.push({ ...data.slots[0], slot: "dinner" });
  result = shoppingNeeds(data, data, day, day);
  expect(result.availability[mealKey(data.slots[1])].missing.map(i => i.ingredientId)).toEqual(["onion-raw"]);
  data = order(base(), [line("beef-95-raw", 500), line("onion-raw", 100)], day, { start: "17:30", end: "20:30", timeZone: "America/Toronto" });
  expect(shoppingNeeds(data, data, day, day).availability[mealKey(data.slots[0])].complete).toBe(false);
  data.slots[0].date = "2026-10-25";
  expect(shoppingNeeds(data, data, day, "2026-10-25").availability[mealKey(data.slots[0])].complete).toBe(true);
});

test("ordered packs without a known weight stay out of new purchases without a false green light", () => {
  const data = order(base(), [line("beef-95-raw", 500), { ingredientId: "onion-raw", quantity: { kind: "count", value: 1, label: "sacs" }, location: "cupboard" }]);
  let result = shoppingNeeds(data, data, day, day);
  const onion = result.items.find(i => i.ingredient.id === "onion-raw")!;
  expect(onion.awaitingConfirmation).toBe(100); expect(toBuyQuantity(onion).value).toBe(0);
  expect(result.availability[mealKey(data.slots[0])].complete).toBe(false);
  expect(result.availability[mealKey(data.slots[0])].missing[0].check).toBe(true);
  // An earlier meal still needs shopping, even if a later meal can await a package check.
  data.slots.push({ ...data.slots[0], date: "2026-10-22" });
  result = shoppingNeeds(data, data, "2026-10-22", day);
  expect(toBuyQuantity(result.items.find(i => i.ingredient.id === "onion-raw")!).value).toBe(100);
});

test("thawing moves just the reserved amount, is idempotent, and cooking deducts fridge stock", () => {
  let data = base();
  data.pantry = [{ id: id(), ingredientId: "beef-95-raw", name: "Bœuf", quantity: { kind: "mass", value: 2000 }, location: "freezer", inStock: true, note: "4 × 500 g" }];
  const now = mealInstant("2026-10-23", "11:00");
  const reminders = thawReminders(data, data, now);
  expect(reminders).toHaveLength(1); expect(reminders[0].quantity.value).toBe(250);
  expect(reminders[0].mealAt - reminders[0].dueAt).toBe(86400000);
  const request = { action: "thaw", id: id(), itemId: data.pantry[0].id, amount: 250 };
  data = applyShoppingMutation(data, request, data);
  expect(data.pantry.find(p => p.location === "freezer")!.quantity!.value).toBe(1750);
  expect(data.pantry.find(p => p.location === "fridge")!.quantity!.value).toBe(250);
  expect(thawReminders(data, data, now)).toHaveLength(0);
  expect(applyShoppingMutation(data, request, data)).toBe(data);
  expect(() => applyShoppingMutation(data, { ...request, id: id(), amount: 2000 }, data)).toThrow();
  data = applyShoppingMutation(data, { action: "cook", id: id(), meal: data.slots[0], portions: 2, includeOptional: false }, data);
  expect(data.pantry.find(p => p.location === "fridge")!.inStock).toBe(false);
  expect(data.pantry.find(p => p.location === "freezer")!.quantity!.value).toBe(1750);
  expect(thawReminders(data, data, now)).toHaveLength(0);
});

test("thaw reminder remains exactly 24 hours before the meal across daylight saving time", () => {
  const data = base(); data.slots[0].date = "2026-11-01";
  data.pantry = [{ id: id(), ingredientId: "beef-95-raw", name: "Bœuf", quantity: { kind: "mass", value: 500 }, location: "freezer", inStock: true, note: "" }];
  expect(new Date(mealInstant("2026-11-01", "12:00")).toISOString()).toBe("2026-11-01T17:00:00.000Z");
  const now = Date.parse("2026-10-30T12:00:00Z"), reminders = thawReminders(data, data, now);
  expect(reminders[0].mealAt - reminders[0].dueAt).toBe(86400000);
  expect(thawReminders({ ...data, slots: [] }, data, now)).toHaveLength(0);
});

test("compact UI supports pantry shortcut, checked orders, coverage explanations and thaw reminders", async ({ page }) => {
  await page.goto("/fr/demo"); const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  // Tomorrow keeps thaw reminders deterministic regardless of test execution time.
  const tomorrow = addDays(localToday(), 1);
  const weekDate = new Date(`${tomorrow}T12:00:00Z`);
  const weekday = weekDate.toLocaleDateString("fr-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  if (weekDate.getUTCDay() === 1) await page.getByRole("button", { name: "Semaine suivante" }).click();
  const dayCard = page.getByRole("article", { name: weekday });
  await dayCard.locator('[data-meal="dinner"] .empty-slot').click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await dayCard.getByRole("button", { name: "Il manque des ingrédients", exact: true }).click();
  await expect(page.getByRole("tooltip")).toContainText("Bœuf haché extra maigre");
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await page.getByRole("button", { name: "Options pour Bœuf haché extra maigre", exact: true }).click();
  await page.getByRole("button", { name: "Déjà en réserve", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantité en réserve", { exact: false }).fill("500");
  await dialog.getByLabel("Cet aliment est congelé", { exact: true }).check();
  await dialog.getByRole("button", { name: "Ajouter à mes réserves", exact: true }).click();
  await expect(page.locator(".grocery-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Commander en ligne", exact: true }).click();
  await dialog.getByLabel("Réception prévue").fill(localToday());
  await dialog.getByRole("button", { name: "J’ai passé ma commande", exact: true }).click();
  await expect(page.locator(".grocery-item")).toHaveCount(0);
  await page.getByLabel("Afficher les aliments déjà prêts", { exact: true }).check();
  await expect(page.locator(".grocery-item input[type=checkbox]:checked")).toHaveCount(2);
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await dayCard.getByRole("button", { name: "Tous les ingrédients sont prévus", exact: true }).click();
  await expect(page.getByRole("tooltip")).toContainText("congelés");
  for (const [width,height] of [[1280,800],[390,844],[1024,768]]) {
    await page.setViewportSize({width,height});
    await dayCard.getByRole("button", { name: "Tous les ingrédients sont prévus", exact: true }).click();
    const box = await page.getByRole("tooltip").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({path:`artifacts/readiness-menu-${width}.png`,animations:"disabled"});
  }
  await page.setViewportSize({width:1280,height:800});
  await nav.getByRole("button", { name: "Mes réserves", exact: true }).click();
  const thaw = page.getByRole("region", { name: "Décongélation à prévoir", exact: true });
  await expect(thaw).toContainText("250 g");
  for (const [width,height] of [[1280,800],[390,844],[412,915],[1024,768]]) {
    await page.setViewportSize({width,height});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`artifacts/readiness-${width}.png`,fullPage:true,animations:"disabled"});
  }
  await thaw.getByRole("button", { name: "Mis au réfrigérateur", exact: true }).click();
  await expect(thaw).not.toBeVisible();
  await expect(page.locator(".pantry-group").filter({hasText:"Congélateur"})).toContainText("250 g");
  await expect(page.locator(".pantry-group").filter({hasText:"Réfrigérateur"})).toContainText("250 g");
});
