import { test, expect } from "@playwright/test";
import { dailyCalories, mealTimes } from "../src/lib/planner";
import { weeklyGroceries } from "../src/lib/groceries";
import { pantryFactor, pantryForIngredient } from "../src/lib/pantry";
import { defaultUnits, addDays } from "../src/lib/units";
import { demoIngredients, demoRecipes } from "../src/lib/demo-recipes";
import { mutationSchema } from "../src/lib/validation";

test("six moments feed calories and groceries; missing values do not masquerade as zero", () => {
  const date = "2026-10-19";
  const slots = mealTimes.map((slot) => ({
    date,
    slot,
    recipeId: demoRecipes[0].id,
  }));
  expect(dailyCalories(date, slots, demoRecipes, demoIngredients)).toEqual({
    kcal: 1147.5,
    meals: 6,
    missing: 0,
  });
  expect(dailyCalories(date, slots, demoRecipes, [])).toEqual({
    kcal: 0,
    meals: 6,
    missing: 6,
  });
  expect(
    dailyCalories("2026-10-20", slots, demoRecipes, demoIngredients).meals,
  ).toBe(0);
  expect(
    weeklyGroceries(demoRecipes, demoIngredients, slots, date).items[0].quantity
      .value,
  ).toBe(1500);
  expect(pantryFactor("mass", { ...defaultUnits, ingredientMass: "oz" })).toBe(
    28.349523125,
  );
  expect(pantryFactor("volume", { ...defaultUnits, volume: "cup" })).toBe(
    236.5882365,
  );
  const item = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Beef",
    ingredientId: "beef-95-raw",
    location: "freezer" as const,
    quantity: null,
    note: "",
    inStock: true,
  };
  expect(
    pantryForIngredient(
      [
        item,
        { ...item, id: "second", inStock: false },
        { ...item, id: "custom", ingredientId: null },
      ],
      "beef-95-raw",
    ),
  ).toEqual([item]);
  expect(
    mutationSchema.safeParse({
      type: "pantry",
      data: { ...item, quantity: { kind: "mass", value: -1 } },
    }).success,
  ).toBe(false);
  expect(
    mutationSchema.safeParse({
      type: "groceryCheck",
      data: { week: "2026-10-20", ingredientId: "beef-95-raw", checked: true },
    }).success,
  ).toBe(false);
});

test("planner aligns all six rows and totals while pantry and weekly checks follow the grocery list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1680, height: 1050 });
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  for (let i = 0; i < 6; i++) {
    await page
      .locator(".week-day")
      .first()
      .locator(".empty-slot")
      .first()
      .click();
    await page
      .getByRole("button", { name: "Choisir cette recette", exact: true })
      .click();
  }
  await expect(page.locator(".day-total").first()).toContainText(
    /1\s?148 kcal/,
  );
  await expect(page.locator(".day-total").nth(1)).toContainText("—");
  for (const slot of mealTimes) {
    const positions = await page
      .locator(`[data-meal="${slot}"]`)
      .evaluateAll((elements) =>
        elements.map((el) => Math.round(el.getBoundingClientRect().top)),
      );
    expect(new Set(positions).size).toBe(1);
  }
  const bottoms = await page
    .locator(".day-total")
    .evaluateAll((elements) =>
      elements.map((el) => Math.round(el.getBoundingClientRect().bottom)),
    );
  expect(new Set(bottoms).size).toBe(1);
  await page.screenshot({
    path: "artifacts/full-day-planner.png",
    fullPage: true,
    animations: "disabled",
  });
  await nav.getByRole("button", { name: "Mes réserves", exact: true }).click();
  await page
    .getByRole("button", { name: "Ajouter un aliment", exact: true })
    .click();
  await page.getByLabel("Aliment", { exact: true }).selectOption("beef-95-raw");
  await page
    .getByLabel("Où le ranger", { exact: true })
    .selectOption("freezer");
  await page.getByLabel("Mesure", { exact: true }).selectOption("mass");
  await page.getByLabel(/Quantité \(facultatif\)/).fill("500");
  await page
    .getByLabel("Petit repère (facultatif)", { exact: true })
    .fill("Deux portions");
  await page
    .getByRole("button", { name: "Garder dans mes réserves", exact: true })
    .click();
  await expect(page.locator(".pantry-group")).toContainText("500 g");
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Afficher les aliments déjà prêts",
      exact: true,
    })
    .check();
  const beef = page
    .locator(".grocery-item")
    .filter({ hasText: "Bœuf haché extra maigre" });
  await expect(beef).toContainText(
    "500 g en réserve",
  );
  await expect(beef.getByRole("checkbox")).not.toBeChecked();
  await expect(beef.locator(".grocery-quantity")).toHaveText(/1\s?000 g/);
  await beef.getByRole("checkbox").check();
  await expect(beef.getByRole("checkbox")).toBeChecked();
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Afficher les aliments déjà prêts",
      exact: true,
    })
    .check();
  await expect(beef.getByRole("checkbox")).toBeChecked();
  const initialStart = await page.getByLabel("Début des courses").inputValue();
  const selectPeriod = async (start: string) => {
    await page.getByLabel("Début des courses").fill(start);
    await page.getByLabel("Fin des courses").fill(addDays(start, 6));
    await page.getByRole("button", { name: "Afficher", exact: true }).click();
  };
  await selectPeriod(addDays(initialStart, 7));
  await page.getByRole("button", { name: "Choisir mes repas", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await expect(beef.getByRole("checkbox")).not.toBeChecked();
  await selectPeriod(initialStart);
  await expect(beef.getByRole("checkbox")).toBeChecked();
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  await page
    .getByLabel("Poids des ingrédients", { exact: true })
    .selectOption("oz");
  await nav.getByRole("button", { name: "Mes réserves", exact: true }).click();
  await expect(page.locator(".pantry-group")).toContainText("17,64 oz");
  await page
    .getByRole("button", { name: "Il n’en reste plus", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Afficher les aliments épuisés", exact: true }).check();
  await expect(page.locator(".pantry-group")).toContainText("À renouveler");
  await nav
    .getByRole("button", { name: "Liste d’épicerie", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Afficher les aliments déjà prêts",
      exact: true,
    })
    .check();
  await expect(beef.locator(".pantry-badge")).toHaveCount(0);
  await expect(beef.getByRole("checkbox")).toBeChecked(); // Independent from stock status.
  await beef.getByRole("checkbox").uncheck();
  await expect(beef.getByRole("checkbox")).not.toBeChecked();
  await nav.getByRole("button", { name: "Mes réserves", exact: true }).click();
  await page.getByRole("checkbox", { name: "Afficher les aliments épuisés", exact: true }).check();
  await page
    .getByRole("button", { name: "J’en ai de nouveau", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/pantry-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: /Retirer des réserves Bœuf/ }).click();
  await expect(page.locator(".pantry-group")).toHaveCount(0);
});
