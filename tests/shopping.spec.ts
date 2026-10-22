import { selectAppOption } from "./select-helper";
import { test, expect } from "@playwright/test";
import { applyShoppingMutation, shoppingNeeds, shoppingState, previewCooking } from "../src/lib/shopping";
import type { ShoppingWorkspace } from "../src/lib/shopping-types";
import { demoIngredients, demoRecipes } from "../src/lib/demo-recipes";
import { defaultUnits, quantityLabel, addDays } from "../src/lib/units";
import { applyPrivateMutation } from "../src/lib/private-mutations";
const id = () => crypto.randomUUID();
const beef = "beef-95-raw", day = "2026-10-25";
const make = (): ShoppingWorkspace => ({ plans: [], journal: [], weights: [], documents: [], ingredients: demoIngredients, recipes: demoRecipes, slots: [{ date: day, slot: "dinner", recipeId: demoRecipes[0].id }, { date: "2026-10-26", slot: "dinner", recipeId: demoRecipes[0].id }], preferences: defaultUnits, groceryChecks: [], pantry: [{ id: id(), ingredientId: beef, name: "Beef", location: "fridge", quantity: { kind: "mass", value: 200 }, note: "", inStock: true }] });
const find = (d: ShoppingWorkspace, start = day, end = "2026-10-26") => shoppingNeeds(d, d, start, end).items.find(i => i.ingredient.id === beef)!;
const line = (value: number) => ({ ingredientId: beef, quantity: { kind: "mass" as const, value }, location: "fridge" as const });

test("free date ranges share chronological reservations across week boundaries and late deliveries", () => {
  let data = make();
  expect(find(data).quantity.value).toBe(300);
  expect(find(data, day, day).quantity.value).toBe(50);
  expect(find(data, "2026-10-26").quantity.value).toBe(250); // 200 g already reserved by Sunday's meal
  const orderId = id();
  data = applyShoppingMutation(data, { action: "order", id: orderId, mode: "online", grocer: "Local", expectedDate: "2026-10-26", fulfillment: "delivery", lines: [line(500)] }, data);
  expect(data.pantry[0].quantity!.value).toBe(200);
  expect(find(data).quantity.value).toBe(50); // Monday's delivery cannot cover Sunday's shortfall
  expect(find(data).pending).toBe(250);
  expect(find(data, "2026-10-26").quantity.value).toBe(0);
  data = applyShoppingMutation(data, { action: "reschedule", id: orderId, expectedDate: "2026-10-27" }, data);
  expect(find(data).quantity.value).toBe(300);
  data = applyShoppingMutation(data, { action: "cancel", id: orderId }, data);
  expect(find(data).pending).toBe(0);
  expect(data.pantry[0].quantity!.value).toBe(200);
});

test("partial receipt adds actual quantities once, closes order, and restores shortages", () => {
  let data = make(); const before = JSON.stringify(data), orderId = id();
  const order = { action: "order", id: orderId, mode: "online", grocer: "Local", expectedDate: day, fulfillment: "pickup", lines: [line(500)] };
  data = applyShoppingMutation(data, order, data);
  expect(find(data).quantity.value).toBe(0);
  expect(applyShoppingMutation(data, order, data)).toBe(data);
  const receipt = { action: "receive", id: orderId, lines: [line(100)] };
  data = applyShoppingMutation(data, receipt, data);
  expect(data.pantry[0].quantity!.value).toBe(300);
  expect(find(data).quantity.value).toBe(200);
  expect(applyShoppingMutation(data, receipt, data)).toBe(data);
  expect(shoppingState(data).orders[0].received?.[0].quantity.value).toBe(100);
  expect(JSON.parse(before).pantry[0].quantity.value).toBe(200);
  expect(() => applyShoppingMutation(data, { action: "cancel", id: orderId }, data)).toThrow();
});

test("actual package stock is deducted by servings only once and undo reverses only recorded amounts", () => {
  let data = make();
  data = applyShoppingMutation(data, { action: "order", id: id(), mode: "store", grocer: "", expectedDate: day, fulfillment: "pickup", lines: [line(500)] }, data);
  expect(data.pantry[0].quantity!.value).toBe(700);
  const cookId = id(), cook = { action: "cook", id: cookId, meal: data.slots[0], portions: 4, includeOptional: false };
  data = applyShoppingMutation(data, cook, data);
  expect(data.pantry[0].quantity!.value).toBe(200); // double recipe, 500 g
  expect(shoppingState(data).cooked[0].missing).toHaveLength(1);
  expect(find(data).quantity.value).toBe(50); // only Monday remains
  expect(applyShoppingMutation(data, { ...cook, id: id() }, data)).toBe(data);
  const withProgram = { ...data, program: { completed: {}, reflections: {} } };
  expect(() => applyPrivateMutation(withProgram, "slot", { ...data.slots[0], recipeId: null }, data)).toThrow("cooked_meal");
  data.pantry[0].quantity!.value = 150; // another use since cooking must be preserved
  data = applyShoppingMutation(data, { action: "undoCook", id: cookId }, data);
  expect(data.pantry[0].quantity!.value).toBe(650);
  expect(applyShoppingMutation(data, { action: "undoCook", id: cookId }, data)).toBe(data);
});

test("quantities keep canonical units, conservative mismatches, optional ingredients, zero stock and labels", () => {
  const data = make(); data.slots = [data.slots[0]];
  data.recipes = [{ ...demoRecipes[0], ingredients: [{ ingredientId: beef, quantity: { kind: "spoon", value: 15 }, grams: 12 }, { ingredientId: "onion-raw", quantity: { kind: "mass", value: 100 }, grams: 100, optional: true }] }];
  data.pantry[0].quantity = { kind: "volume", value: 5 };
  const item = find(data);
  expect(item.quantity).toEqual({ kind: "spoon", value: 10 });
  expect(quantityLabel(item.quantity, { ...defaultUnits, spoons: "ml" }, "fr")).toBe("10 ml");
  expect(shoppingNeeds(data, data, day, day).items).toHaveLength(1);
  expect(shoppingNeeds(data, data, day, day, true).items).toHaveLength(2);
  data.pantry[0].quantity = { kind: "count", value: 2, label: "boîtes" };
  expect(find(data).needsStockCheck).toBe(true);
  expect(previewCooking(data, data, data.slots[0], 2, false).deductions).toHaveLength(0);
  expect(data.pantry[0].quantity.value).toBe(2);
});

test("legacy checks stay checked for their period; invalid suppliers and requests are rejected", () => {
  const data = make(); data.groceryChecks = [{ week: "2026-10-19", ingredientId: beef, checked: true }];
  expect(shoppingState(data).selections["2026-10-19:2026-10-25"]).toEqual([beef]);
  const next = applyShoppingMutation(data, { action: "select", range: { start: "2026-10-19", end: day }, ingredientId: beef, checked: false }, data);
  expect(shoppingState(next).selections["2026-10-19:2026-10-25"]).toEqual([]);
  expect(() => applyShoppingMutation(data, { action: "grocers", grocers: [{ id: id(), name: "Bad", url: "javascript:alert(1)", favorite: true, fulfillment: "delivery" }] }, data)).toThrow();
  expect(() => applyShoppingMutation(data, { action: "range", range: { start: day, end: "2026-10-19" } }, data)).toThrow();
  expect(() => applyShoppingMutation(data, { action: "cook", id: id(), meal: { ...data.slots[0], recipeId: "other" }, portions: 2, includeOptional: false }, data)).toThrow();
  expect(() => applyShoppingMutation(data, { action: "order", id: id(), mode: "store", grocer: "", expectedDate: day, fulfillment: "pickup", lines: [line(-1)] }, data)).toThrow();
});

test("shopping UI covers suppliers, free dates, receipts, cooking and compact four-format layout", async ({ page }) => {
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter un épicier", exact: true }).click();
  await page.getByLabel("Nom de l’épicier", { exact: true }).fill("Épicier test");
  await page.getByLabel("Site Web (facultatif)").fill("https://example.com");
  await selectAppOption(page.getByLabel("Réception habituelle"), "pickup");
  await page.getByRole("button", { name: "Enregistrer l’épicier", exact: true }).click();
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await expect(page.locator(".grocery-aisle>h2")).toHaveText(["Fruits et légumes 1", "Viandes et volailles 1"]);
  await page.getByRole("button", { name: "Commander en ligne", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Épicier", { exact: true })).not.toHaveAttribute("data-value", "");
  await expect(dialog.getByLabel("Mode de réception", { exact: true })).toHaveAttribute("data-value", "pickup");
  const start = await page.getByLabel("Début des courses").inputValue();
  await dialog.getByLabel("Réception prévue").fill(start);
  await dialog.getByLabel("Quantité Bœuf haché extra maigre", { exact: true }).fill("500");
  await dialog.getByRole("button", { name: "J’ai passé ma commande", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".pending-order")).toHaveCount(1);
  await page.getByRole("button", { name: "Voir mes réserves", exact: true }).click();
  await expect(page.locator(".pantry-groups").getByRole("listitem")).toHaveCount(0);
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await page.getByRole("button", { name: "J’ai reçu ma commande", exact: true }).click();
  await dialog.getByRole("button", { name: "Vérifier manuellement", exact: true }).click();
  await dialog.getByLabel("Quantité Oignon", { exact: true }).fill("0");
  await dialog.getByRole("button", { name: "Confirmer et ajouter aux réserves", exact: true }).click();
  await expect(page.locator(".pending-order")).toHaveCount(0);
  await expect(page.locator(".grocery-item")).toHaveCount(1);
  await expect(page.locator(".grocery-item")).toContainText("Oignon");
  await page.getByRole("checkbox", { name: "Cocher Oignon", exact: true }).check();
  await page.getByRole("button", { name: "Ranger mes achats", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmer et ajouter aux réserves", exact: true }).click();
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.getByRole("button", { name: "J’ai cuisiné", exact: true }).first().click();
  await expect(dialog).toContainText("250 g");
  await dialog.getByRole("button", { name: "Confirmer la préparation", exact: true }).click();
  await expect(page.locator(".cook-slot-action").first()).toContainText("Cuisiné");
  await page.getByRole("button", { name: "Annuler la préparation", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "J’ai cuisiné", exact: true }).first()).toBeVisible();
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await page.getByLabel("Fin des courses").fill(addDays(start, 9));
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
  await expect(page.getByLabel("Fin des courses")).toHaveValue(addDays(start, 9));
  await page.getByRole("checkbox", { name: "Afficher les aliments déjà prêts", exact: true }).check();
  for (const [width, height, label] of [[1280,800,"galaxy-tab"],[390,844,"iphone"],[412,915,"android-phone"],[1024,768,"ipad"]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const row = page.locator(".grocery-item").first();
    const ingredient = await row.locator("h3").boundingBox(), recipes = await row.locator(".grocery-recipes").boundingBox();
    expect(recipes!.x).toBeGreaterThan(ingredient!.x + ingredient!.width - 1);
    await page.screenshot({ path: `artifacts/shopping-${label}.png`, fullPage: true, animations: "disabled" });
  }
});

test("mixed units aggregate each recipe gram equivalent without assuming identical piece sizes", () => {
  const data = make(); data.pantry = []; data.slots = [data.slots[0]];
  data.recipes = [{ ...demoRecipes[0], ingredients: [
    { ingredientId: beef, quantity: { kind: "count", value: 1 }, grams: 50 },
    { ingredientId: beef, quantity: { kind: "count", value: 1 }, grams: 100 },
    { ingredientId: beef, quantity: { kind: "mass", value: 100 }, grams: 100 },
  ] }];
  expect(find(data)).toMatchObject({ quantity: { kind: "mass", value: 250 }, required: 250, estimated: true });
});
