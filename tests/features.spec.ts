import { selectAppOption } from "./select-helper";
import { test, expect } from "@playwright/test";
import {
  recipeNutrition,
  defaultUnits,
  measure,
  bodyWeight,
  monday,
} from "../src/lib/units";
import { demoRecipes, demoIngredients } from "../src/lib/demo-recipes";

test("canonical ingredient quantities drive nutrition; conversions preserve stored values", () => {
  const original = JSON.stringify(demoRecipes[0]);
  expect(recipeNutrition(demoRecipes[0], demoIngredients)?.kcal).toBeCloseTo(
    191.25,
    5,
  );
  expect(recipeNutrition(demoRecipes[0], [])).toBeNull();
  expect(bodyWeight(100, "kg", "lb")).toBeCloseTo(220.46226218, 7);
  expect(bodyWeight(bodyWeight(100, "kg", "lb"), "lb", "kg")).toBeCloseTo(
    100,
    10,
  );
  expect(measure("spoon", 15, { ...defaultUnits, spoons: "ml" }, "fr")).toBe(
    "15 ml",
  );
  expect(
    measure("temp", 100, { ...defaultUnits, temperature: "F" }, "en"),
  ).toBe("212 °F");
  expect(
    measure("volume", 236.5882365, { ...defaultUnits, volume: "cup" }, "en"),
  ).toBe("1 US cup");
  expect(
    measure(
      "mass",
      28.349523125,
      { ...defaultUnits, ingredientMass: "oz" },
      "en",
    ),
  ).toBe("1 oz");
  expect(monday("2026-10-25")).toBe("2026-10-19");
  expect(JSON.stringify(demoRecipes[0])).toBe(original);
});

test("seven days, recipe selection, removal and week navigation", async ({
  page,
}) => {
  await page.goto("/fr/demo");
  await expect(page.locator(".week-day")).toHaveCount(7);
  await expect(page.locator(".empty-slot")).toHaveCount(42);
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette" }).click();
  await expect(page.locator(".planned-recipe")).toHaveCount(1);
  await page.locator(".planned-recipe").click();
  await expect(
    page.getByRole("dialog", { name: "Bœuf et oignons" }),
  ).toBeVisible();
  await expect(page.locator(".nutrition-calories")).toContainText("191");
  await page.getByRole("button", { name: "Fermer la recette" }).click();
  await page.getByRole("button", { name: "Semaine suivante" }).click();
  await expect(page.locator(".planned-recipe")).toHaveCount(0);
  await page.getByRole("button", { name: "Semaine précédente" }).click();
  await expect(page.locator(".planned-recipe")).toHaveCount(1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mes menus" })
    .click();
  await page.getByRole("button", { name: /Retirer Déjeuner/ }).click();
  await expect(page.locator(".planned-recipe")).toHaveCount(0);
});

test("granular settings convert recipes, steps, current weight and history independently", async ({
  page,
}) => {
  await page.goto("/fr/demo");
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  await selectAppOption(page.getByLabel("Poids corporel", { exact: true }), "kg");
  await selectAppOption(page
    .getByLabel("Poids des ingrédients", { exact: true }), "oz");
  await selectAppOption(page.getByLabel("Volumes et liquides"), "cup");
  await selectAppOption(page.getByLabel("Petites quantités et cuillères"), "ml");
  await selectAppOption(page.getByLabel("Température de cuisson"), "F");
  await selectAppOption(page.getByLabel("Dimensions et épaisseurs"), "in");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon parcours" })
    .click();
  await expect(page.locator(".weight-value")).toContainText("84,2");
  await expect(page.locator(".history")).toContainText("kg");
  await page.getByRole("button", { name: "Noter mon poids" }).click();
  await expect(page.getByLabel("Unité", { exact: true })).toHaveAttribute("data-value", "kg");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mes recettes" })
    .click();
  await page.locator(".recipe-open").click();
  await expect(page.locator(".ingredient-list")).toContainText("8,82 oz");
  await expect(page.locator(".recipe-steps")).toContainText("160 °F");
  await expect(page.locator(".recipe-note")).toContainText("15 ml");
  await expect(page.locator(".recipe-note")).toContainText("≈ 1 tasse US");
  await expect(page.locator(".nutrition-calories")).toContainText("191");
});

test("journal preserves paragraphs and selection-only AI suggestions require acceptance", async ({
  page,
}) => {
  await page.goto("/fr/demo");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon journal" })
    .click();
  const editor = page.getByLabel("Texte du journal");
  const original = "Je suis aller marcher.\n\nUne belle journée.";
  await editor.fill(original);
  await page.getByLabel("Titre de la page").fill("Ma journée");
  await editor.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, 21);
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
  let sent = "";
  await page.route("**/api/journal/edit", async (route) => {
    sent = route.request().postDataJSON().text;
    await route.fulfill({ json: { text: "Je suis allé marcher." } });
  });
  await page.getByRole("button", { name: "Corriger les fautes" }).click();
  await expect(
    page.getByRole("button", { name: "Accepter la proposition" }),
  ).toBeVisible();
  expect(sent).toBe("Je suis aller marcher");
  await expect(editor).toHaveValue(original);
  await page.getByRole("button", { name: "Ignorer", exact: true }).click();
  await expect(editor).toHaveValue(original);
  await editor.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, 22);
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Corriger les fautes" }).click();
  await page.getByRole("button", { name: "Accepter la proposition" }).click();
  await expect(editor).toHaveValue(
    "Je suis allé marcher.\n\nUne belle journée.",
  );
  await page.getByRole("button", { name: "Annuler la correction" }).click();
  await expect(editor).toHaveValue(original);
  await page.getByRole("button", { name: "Enregistrer ma page" }).click();
  await expect(page.getByRole("status")).toContainText("page est enregistrée");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mes recettes" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon journal" })
    .click();
  await expect(editor).toHaveValue(original);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});

test("AI and recipe images reject anonymous and cross-origin access", async ({
  request,
}) => {
  expect((await request.get("/api/recipe-images/diy-01-hero")).status()).toBe(
    401,
  );
  expect(
    (
      await request.post("/api/journal/edit", {
        headers: { origin: "http://127.0.0.1:3000" },
        data: { action: "correct", text: "Hello" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/journal/edit", {
        headers: { origin: "https://example.com" },
        data: { action: "correct", text: "Hello" },
      })
    ).status(),
  ).toBe(403);
});

test("a stale AI proposal cannot replace newer writing and errors preserve the draft", async ({
  page,
}) => {
  await page.goto("/fr/demo");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon journal" })
    .click();
  const editor = page.getByLabel("Texte du journal");
  await editor.fill("Mon texte initial.");
  await page.route("**/api/journal/edit", (r) =>
    r.fulfill({ json: { text: "Texte proposé." } }),
  );
  await page.getByRole("button", { name: "Améliorer le texte" }).click();
  await expect(
    page.getByRole("button", { name: "Accepter la proposition" }),
  ).toBeVisible();
  await editor.fill("Nouvelle pensée.");
  await expect(
    page.getByRole("button", { name: "Accepter la proposition" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Ignorer", exact: true }).click();
  await page.unroute("**/api/journal/edit");
  await page.route("**/api/journal/edit", (r) =>
    r.fulfill({ status: 503, json: { error: "ai_unavailable" } }),
  );
  await page.getByRole("button", { name: "Améliorer le texte" }).click();
  await expect(page.locator(".journal-paper").getByRole("alert")).toContainText(
    "n’est pas disponible",
  );
  await expect(editor).toHaveValue("Nouvelle pensée.");
});
