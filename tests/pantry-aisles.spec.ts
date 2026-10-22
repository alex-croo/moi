import { selectAppOption } from "./select-helper";
import { test, expect } from "@playwright/test";
import { demoData } from "../src/lib/demo";
import { applyPrivateMutation } from "../src/lib/private-mutations";
import { applyShoppingMutation, shoppingNeeds, previewCooking, mealKey, shoppingState } from "../src/lib/shopping";
import { pantryAisle, pantryQuantityLabel } from "../src/lib/pantry";
import { defaultUnits } from "../src/lib/units";
import type { ShoppingWorkspace } from "../src/lib/shopping-types";

function garlicStock() {
  const ingredient = { ...demoData.ingredients[0], id: "ail-frais", name: "Ail frais", nameEn: "Garlic" };
  const recipe = { ...demoData.recipes[0], ingredients: [{ ingredientId: "ail-frais", grams: 8.4, quantity: { kind: "spoon" as const, value: 15 } }] };
  return { ...structuredClone(demoData), ingredients: [ingredient], recipes: [recipe], slots: [{ date: "2026-10-25", slot: "dinner" as const, recipeId: recipe.id }], pantry: [{ id: crypto.randomUUID(), ingredientId: ingredient.id, name: ingredient.name, location: "fridge" as const, quantity: { kind: "count" as const, value: 40, label: "gousses", labelEn: "cloves" }, note: "", inStock: true }] } satisfies ShoppingWorkspace;
}

test("explicit garlic cloves cover spoon recipes, deduct actual stock and undo exactly", () => {
  const data = garlicStock(), before = JSON.stringify(data);
  const need = shoppingNeeds(data, data, "2026-10-25", "2026-10-25");
  expect(need.items[0]).toMatchObject({ quantity: { value: 0 }, estimated: true, needsStockCheck: false });
  expect(need.availability[mealKey(data.slots[0])].complete).toBe(true);
  expect(previewCooking(data, data, data.slots[0], data.recipes[0].servings, false).deductions[0].amount).toBeCloseTo(2.8);
  const id = crypto.randomUUID();
  const cooked = applyShoppingMutation(data, { action: "cook", id, meal: data.slots[0], portions: data.recipes[0].servings, includeOptional: false }, data);
  expect(cooked.pantry[0].quantity?.value).toBeCloseTo(37.2);
  expect(shoppingState(cooked).cooked[0].missing).toHaveLength(0);
  expect(applyShoppingMutation(cooked, { action: "undoCook", id }, data).pantry[0].quantity?.value).toBe(40);
  expect(JSON.stringify(data)).toBe(before);
});

test("garlic pieces never imply packages; partial stock and cross-date reservations remain conservative", () => {
  const data = garlicStock();
  data.pantry[0].quantity.value = 1;
  expect(shoppingNeeds(data, data, "2026-10-25", "2026-10-25").items[0].quantity.value).toBeCloseTo(15 - 3 * 15 / 8.4);
  for (const label of ["", "paquets", "bulbs"]) {
    data.pantry[0].quantity = { kind: "count", value: 40, label, labelEn: "" };
    const result = shoppingNeeds(data, data, "2026-10-25", "2026-10-25").items[0];
    expect(result.needsStockCheck).toBe(label !== "bulbs");
  }
  data.pantry[0].quantity = { kind: "count", value: 3, label: "gousses", labelEn: "cloves" };
  data.slots.push({ ...data.slots[0], date: "2026-10-26" });
  const second = shoppingNeeds(data, data, "2026-10-26", "2026-10-26").items[0];
  expect(second.onHand).toBeCloseTo(.2 * 3 * 15 / 8.4);
  expect(second.quantity.value).toBeGreaterThan(13);
});

test("personal food categories survive mutation and JSON reload without a catalog recipe", () => {
  const current = { ...demoData, program: { completed: {}, reflections: {} } };
  const food = { id: crypto.randomUUID(), ingredientId: null, name: "Yogourt maison", aisle: "dairy", location: "fridge", quantity: { kind: "volume", value: 500 }, inStock: true, note: "" };
  const saved = JSON.parse(JSON.stringify(applyPrivateMutation(current, "pantry", food)));
  expect(pantryAisle(saved.pantry[0], [])).toBe("dairy");
  expect(saved.pantry[0].quantity).toEqual(food.quantity);
  expect(() => applyPrivateMutation(current, "pantry", { ...food, aisle: "invalid" })).toThrow();
  expect(pantryQuantityLabel({ kind: "count", value: 20 }, defaultUnits, "fr")).toBe("20 unités");
});

test("compact pantry groups personal foods by aisle, keeps location and preserves edits on mobile", async ({ page }) => {
  await page.goto("/fr/demo");
  await page.getByRole("navigation").getByRole("button", { name: "Mes réserves", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter un aliment personnel", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Mesure", { exact: true })).toHaveAttribute("data-value", "volume");
  await dialog.getByLabel("Nom de l’aliment", { exact: true }).fill("Yogourt maison");
  await selectAppOption(dialog.getByLabel("Rayon", { exact: true }), "dairy");
  await selectAppOption(dialog.getByLabel("Où le ranger", { exact: true }), "fridge");
  await dialog.getByLabel(/Quantité \(facultatif\)/).fill("500");
  await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
  const section = page.getByRole("region", { name: "Produits laitiers et œufs", exact: true });
  await expect(section).toContainText("Yogourt maison");
  await expect(section).toContainText("Réfrigérateur");
  await expect(section).toContainText("500 ml");
  const row = section.getByRole("listitem");
  expect((await row.boundingBox())!.height).toBeLessThan(65);
  await page.screenshot({ path: "artifacts/pantry-aisles-desktop.png", fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await row.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator(".sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "artifacts/pantry-aisles-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Modifier Yogourt maison", exact: true }).click();
  await expect(dialog.getByLabel("Rayon", { exact: true })).toHaveAttribute("data-value", "dairy");
  await expect(dialog.getByLabel(/Quantité \(facultatif\)/)).toHaveValue("500");
  await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
  await expect(row).toHaveCount(1);
});

test("a mismatched saved stock is edited from groceries instead of silently adding a duplicate", async ({ page }) => {
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await nav.getByRole("button", { name: "Mes réserves", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter un aliment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await selectAppOption(dialog.getByLabel("Aliment", { exact: true }), "beef-95-raw");
  await selectAppOption(dialog.getByLabel("Mesure", { exact: true }), "count");
  await dialog.getByLabel(/Quantité \(facultatif\)/).fill("20");
  await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await expect(page.locator(".grocery-stock-warning")).toContainText("20 unités");
  await page.getByRole("button", { name: "Vérifier ma réserve", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Ajouter à mes réserves", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Modifier cette réserve", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Modifier un aliment");
  await expect(dialog.getByLabel(/Quantité \(facultatif\)/)).toHaveValue("20");
  await selectAppOption(dialog.getByLabel("Mesure", { exact: true }), "mass");
  await dialog.getByLabel(/Quantité \(facultatif\)/).fill("250");
  await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
  await expect(page.locator(".pantry-group li")).toHaveCount(1);
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await expect(page.locator(".grocery-item").filter({ hasText: "Bœuf haché extra maigre" })).toHaveCount(0);
});
