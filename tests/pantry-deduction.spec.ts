import { test, expect } from "@playwright/test";
import { groceriesAfterPantry, type GroceryItem } from "../src/lib/groceries";
import { demoIngredients } from "../src/lib/demo-recipes";
import { defaultUnits, quantityLabel } from "../src/lib/units";
import type { PantryItem, Quantity } from "../src/lib/types";

const item = (quantity: Quantity): GroceryItem => ({
  ingredient: demoIngredients[0],
  quantity,
  estimated: false,
  uses: [],
});
const stock = (
  quantity: Quantity | null,
  patch: Partial<PantryItem> = {},
): PantryItem => ({
  id: "test",
  ingredientId: demoIngredients[0].id,
  name: "Beef",
  quantity,
  location: "freezer",
  inStock: true,
  note: "",
  ...patch,
});

test("pantry totals all locations before conversion, clamps surplus and never mutates reserves", () => {
  const required = [item({ kind: "mass", value: 1000 })];
  const pantry = [
    stock({ kind: "mass", value: 250 }),
    stock({ kind: "mass", value: 200 }, { id: "fridge", location: "fridge" }),
    stock({ kind: "mass", value: 900 }, { inStock: false }),
    stock({ kind: "mass", value: 900 }, { ingredientId: null }),
    stock({ kind: "mass", value: 900 }, { ingredientId: "different-beef" }),
  ];
  const before = JSON.stringify({ required, pantry });
  const [result] = groceriesAfterPantry(required, pantry);
  expect(result.quantity.value).toBe(550);
  expect(result.deducted).toBe(450);
  expect(result.needsStockCheck).toBe(false);
  expect(
    quantityLabel(
      result.quantity,
      { ...defaultUnits, ingredientMass: "oz" },
      "en",
    ),
  ).toBe("19.4 oz");
  expect(JSON.stringify({ required, pantry })).toBe(before);
  expect(
    groceriesAfterPantry(required, [stock({ kind: "mass", value: 2000 })])[0]
      .quantity.value,
  ).toBe(0);
});

test("volume and spoons are compatible but missing quantities, density and piece sizes are not invented", () => {
  const [liquid] = groceriesAfterPantry(
    [item({ kind: "volume", value: 60 })],
    [stock({ kind: "spoon", value: 15 }), stock({ kind: "volume", value: 30 })],
  );
  expect(liquid.quantity.value).toBe(15);
  expect(
    quantityLabel(liquid.quantity, { ...defaultUnits, volume: "fl_oz" }, "en"),
  ).toBe("0.51 fl oz US");
  const [unknown] = groceriesAfterPantry(
    [item({ kind: "mass", value: 100 })],
    [
      stock(null),
      stock({ kind: "volume", value: 100 }),
      stock({ kind: "mass", value: 20 }),
    ],
  );
  expect(unknown.quantity.value).toBe(80);
  expect(unknown.needsStockCheck).toBe(true);
  const [count] = groceriesAfterPantry(
    [item({ kind: "count", value: 3, label: "pièce" })],
    [
      stock({ kind: "count", value: 1, label: "pièce" }),
      stock({ kind: "count", value: 2, label: "boîte" }),
    ],
  );
  expect(count.quantity.value).toBe(2);
  expect(count.needsStockCheck).toBe(true);
});

test("grocery list hides covered items and copies only the missing quantity in chosen units", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page
    .getByRole("button", { name: "Choisir cette recette", exact: true })
    .click();
  await nav.getByRole("button", { name: "Mes réserves", exact: true }).click();
  for (const [id, quantity] of [
    ["beef-95-raw", "100"],
    ["onion-raw", "200"],
  ]) {
    await page
      .getByRole("button", { name: "Ajouter un aliment", exact: true })
      .click();
    await page.getByLabel("Aliment", { exact: true }).selectOption(id);
    await page.getByLabel("Mesure", { exact: true }).selectOption("mass");
    await page.getByLabel(/Quantité \(facultatif\)/).fill(quantity);
    await page
      .getByRole("button", { name: "Garder dans mes réserves", exact: true })
      .click();
  }
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await expect(page.locator(".grocery-item")).toHaveCount(1);
  await expect(page.locator(".grocery-quantity")).toHaveText("150 g");
  await page
    .getByRole("button", { name: "Copier la liste", exact: true })
    .click();
  let copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Bœuf haché extra maigre : 150 g");
  expect(copied).not.toContain("Oignon");
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  await page
    .getByLabel("Poids des ingrédients", { exact: true })
    .selectOption("oz");
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await expect(page.locator(".grocery-quantity")).toHaveText("5,29 oz");
  await page
    .getByRole("checkbox", {
      name: "Afficher les aliments déjà prêts",
      exact: true,
    })
    .check();
  await expect(page.locator(".grocery-item")).toHaveCount(2);
  await expect(
    page
      .locator(".grocery-item")
      .filter({
        has: page.getByRole("heading", { name: "Oignon", exact: true }),
      })
      .locator(".grocery-quantity"),
  ).toHaveText("Déjà à la maison");
});
