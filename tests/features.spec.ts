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
  await page.getByRole("navigation").getByRole("button",{name:"Mes menus",exact:true}).click();
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

test("journal preserves paragraphs, autosaves, and selection-only AI suggestions require acceptance", async ({page}) => {
  await page.goto("/fr/demo");
  await page.getByRole("navigation").getByRole("button", {name:"Mon journal",exact:true}).click();
  await page.getByRole("button",{name:"Écrire aujourd’hui",exact:true}).click();
  const editor=page.getByLabel("Texte du journal");
  const original="Je suis aller marcher.\n\nUne belle journée.";
  await editor.fill(original);await page.getByLabel("Titre de la page").fill("Ma journée");
  const select=async()=>editor.evaluate(async(el:HTMLTextAreaElement)=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));el.focus();el.setSelectionRange(0,22);el.dispatchEvent(new Event("select",{bubbles:true}));});
  let sent="";await page.route("**/api/journal/edit",async route=>{sent=route.request().postDataJSON().text;await route.fulfill({json:{text:"Je suis allé marcher."}});});
  await select();await page.getByRole("button",{name:"Corriger les fautes",exact:true}).click();
  await expect(page.locator(".journal-inline-review del")).toContainText("aller");expect(sent).toBe("Je suis aller marcher.");
  await page.getByRole("button",{name:"Refuser",exact:true}).click();await expect(editor).toHaveValue(original);
  await select();await page.getByRole("button",{name:"Corriger les fautes",exact:true}).click();await page.getByRole("button",{name:"Accepter",exact:true}).click();
  await expect(editor).toHaveValue("Je suis allé marcher.\n\nUne belle journée.");
  await page.getByRole("button",{name:"Annuler la correction"}).click();await expect(editor).toHaveValue(original);
  await expect(page.locator(".journal-autosave-indicator")).toContainText("Enregistré");
  await page.getByRole("navigation").getByRole("button",{name:"Mes recettes",exact:true}).click();
  await page.getByRole("navigation").getByRole("button",{name:"Mon journal",exact:true}).click();
  await page.getByRole("button",{name:"Écrire aujourd’hui",exact:true}).first().click();await expect(editor).toHaveValue(original);
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

test("review locks the draft until acceptance or rejection and AI errors preserve writing", async ({page}) => {
 await page.goto("/fr/demo");await page.getByRole("navigation").getByRole("button",{name:"Mon journal",exact:true}).click();await page.getByRole("button",{name:"Écrire aujourd’hui",exact:true}).click();
 const editor=page.getByLabel("Texte du journal");await editor.fill("Mon texte initial.");
 const select=async()=>editor.evaluate(async(el:HTMLTextAreaElement)=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));el.focus();el.select();el.dispatchEvent(new Event("select",{bubbles:true}));});
 await page.route("**/api/journal/edit",r=>r.fulfill({json:{text:"Texte proposé."}}));
 await select();await page.getByRole("button",{name:"Améliorer",exact:true}).click();
 await expect(page.getByLabel("Titre de la page")).toBeDisabled();await expect(editor).toHaveCount(0);
 await page.getByRole("button",{name:"Refuser",exact:true}).click();await expect(editor).toHaveValue("Mon texte initial.");
 await editor.fill("Nouvelle pensée.");await page.unroute("**/api/journal/edit");await page.route("**/api/journal/edit",r=>r.fulfill({status:503,json:{error:"ai_unavailable"}}));
 await select();await page.getByRole("button",{name:"Améliorer",exact:true}).click();await expect(page.locator(".journal-paper").getByRole("alert")).toBeVisible();await expect(editor).toHaveValue("Nouvelle pensée.");
});
