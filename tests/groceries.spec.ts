import { test, expect } from "@playwright/test";
import { weeklyGroceries } from "../src/lib/groceries";
import { defaultUnits, quantityLabel } from "../src/lib/units";
import { demoIngredients, demoRecipes } from "../src/lib/demo-recipes";
import type { Recipe, RecipeIngredient } from "../src/lib/types";

const week = "2026-10-19";
const recipe = (id: string, ingredients: RecipeIngredient[]): Recipe => ({
  ...demoRecipes[0],
  id,
  ingredients,
});

test("groceries sum canonical ingredients across recipes and repeated meals within seven days only", () => {
  const a = demoRecipes[0];
  const b = recipe("second", [
    {
      ingredientId: "beef-95-raw",
      grams: 125,
      quantity: { kind: "mass", value: 125 },
    },
  ]);
  const recipes = [a, b];
  const snapshot = JSON.stringify(recipes);
  const result = weeklyGroceries(
    recipes,
    demoIngredients,
    [
      { date: week, slot: "lunch", recipeId: a.id },
      { date: week, slot: "dinner", recipeId: a.id },
      { date: "2026-10-25", slot: "dinner", recipeId: b.id },
      { date: "2026-10-18", slot: "dinner", recipeId: b.id },
      { date: "2026-10-26", slot: "lunch", recipeId: b.id },
    ],
    week,
  );
  expect(result.meals).toBe(3);
  expect(result.missing).toBe(0);
  expect(result.items).toHaveLength(2);
  const beef = result.items.find((i) => i.ingredient.id === "beef-95-raw")!;
  expect(beef.quantity.value).toBe(625);
  expect(beef.estimated).toBe(false);
  expect(beef.uses.map((u) => u.meals)).toEqual([2, 1]);
  expect(
    quantityLabel(
      beef.quantity,
      { ...defaultUnits, ingredientMass: "oz" },
      "en",
    ),
  ).toBe("22.05 oz");
  expect(JSON.stringify(recipes)).toBe(snapshot);
});

test("groceries combine spoon volumes, distinguish identities and label mixed dimensions as estimates", () => {
  const ingredients = [
    demoIngredients[0],
    { ...demoIngredients[0], id: "distinct" },
    demoIngredients[1],
  ];
  const lines: RecipeIngredient[] = [
    {
      ingredientId: "beef-95-raw",
      grams: 90,
      quantity: { kind: "volume", value: 100 },
    },
    {
      ingredientId: "beef-95-raw",
      grams: 13.5,
      quantity: { kind: "spoon", value: 15 },
    },
    {
      ingredientId: "distinct",
      grams: 50,
      quantity: { kind: "mass", value: 50 },
    },
    {
      ingredientId: "onion-raw",
      grams: 150,
      quantity: { kind: "count", value: 1 },
    },
    {
      ingredientId: "onion-raw",
      grams: 50,
      quantity: { kind: "mass", value: 50 },
    },
    {
      ingredientId: "distinct",
      grams: 10,
      quantity: { kind: "mass", value: 10 },
      optional: true,
    },
  ];
  const recipes = [recipe("mixed", lines)];
  const slots = [{ date: week, slot: "lunch" as const, recipeId: "mixed" }];
  const result = weeklyGroceries(recipes, ingredients, slots, week);
  expect(result.items).toHaveLength(3); // Same name, different canonical identities.
  expect(result.items[0].quantity).toEqual({ kind: "volume", value: 115 });
  expect(
    quantityLabel(
      result.items[0].quantity,
      { ...defaultUnits, volume: "cup" },
      "en",
    ),
  ).toBe("0.49 US cup");
  expect(result.items[1].quantity.value).toBe(50);
  expect(result.items[2].quantity).toEqual({ kind: "mass", value: 200 });
  expect(result.items[2].estimated).toBe(true);
  expect(
    weeklyGroceries(recipes, ingredients, slots, week, true).items[1].quantity
      .value,
  ).toBe(60);
  const spoonRecipe = recipe("spoons", [
    {
      ingredientId: "beef-95-raw",
      grams: 4,
      quantity: { kind: "spoon", value: 5 },
    },
    {
      ingredientId: "beef-95-raw",
      grams: 8,
      quantity: { kind: "spoon", value: 10 },
    },
  ]);
  const spoon = weeklyGroceries(
    [spoonRecipe],
    ingredients,
    [{ date: week, slot: "lunch", recipeId: "spoons" }],
    week,
  ).items[0];
  expect(quantityLabel(spoon.quantity, defaultUnits, "en")).toBe("1 tbsp");
  expect(
    quantityLabel(spoon.quantity, { ...defaultUnits, spoons: "ml" }, "en"),
  ).toBe("15 ml");
  const counts = recipe("counts", [
    {
      ingredientId: "onion-raw",
      grams: 100,
      quantity: { kind: "count", value: 1, label: "pièce" },
    },
    {
      ingredientId: "onion-raw",
      grams: 200,
      quantity: { kind: "count", value: 2, label: "pièce" },
    },
  ]);
  const count = weeklyGroceries(
    [counts],
    ingredients,
    [{ date: week, slot: "lunch", recipeId: "counts" }],
    week,
  ).items[0];
  expect(count.quantity.value).toBe(3);
  expect(count.estimated).toBe(false);
  const missing = weeklyGroceries(
    recipes,
    [],
    [...slots, { date: week, slot: "dinner", recipeId: "missing" }],
    week,
  );
  expect(missing.items).toHaveLength(0);
  expect(missing.missing).toBeGreaterThan(0);
});

test("sidebar grocery list follows planner weeks, meal edits, units and language on mobile", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/fr/demo");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await expect(
    page.getByText("Votre épicerie commence par vos repas.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choisir mes repas", exact: true })
    .click();
  for (let i = 0; i < 2; i++) {
    await page.locator(".empty-slot").first().click();
    await page
      .getByRole("button", { name: "Choisir cette recette", exact: true })
      .click();
  }
  const nav = page.getByRole("navigation");
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await expect(page.locator(".grocery-item")).toHaveCount(2);
  const beef = page
    .locator(".grocery-item")
    .filter({ hasText: "Bœuf haché extra maigre" });
  await expect(beef.locator(".grocery-quantity")).toHaveText("500 g");
  await expect(page.locator(".grocery-summary")).toContainText(
    "2 repas prévus",
  );
  await page
    .getByRole("button", { name: "Copier la liste", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Liste copiée.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Bœuf haché extra maigre : 500 g",
  );
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  await page
    .getByLabel("Poids des ingrédients", { exact: true })
    .selectOption("oz");
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await expect(beef.locator(".grocery-quantity")).toHaveText("17,64 oz");
  await page
    .getByRole("button", { name: "Semaine suivante", exact: true })
    .click();
  await expect(page.locator(".grocery-item")).toHaveCount(0);
  const selectedWeek = await page
    .locator(".week-navigation strong")
    .innerText();
  await page
    .getByRole("button", { name: "Voir les repas", exact: true })
    .click();
  await expect(page.locator(".week-navigation strong")).toHaveText(
    selectedWeek,
  );
  await expect(page.locator(".planned-recipe")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Semaine précédente", exact: true })
    .click();
  await page.getByRole("button", { name: /Retirer Déjeuner/ }).click();
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await expect(beef.locator(".grocery-quantity")).toHaveText("8,82 oz");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My grocery list.", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".grocery-item").filter({ hasText: "Extra lean ground beef" }),
  ).toContainText("8.82 oz");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    nav.getByRole("button", { name: "Grocery list", exact: true }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Grocery list", exact: true }).click();
  await page.screenshot({
    path: "artifacts/groceries-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
