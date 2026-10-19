import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { buildRecipePdf } from "../src/lib/recipe-pdf";
import { demoRecipes, demoIngredients } from "../src/lib/demo-recipes";
import { defaultUnits } from "../src/lib/units";

test("recipe book keeps separate Letter cards and rejects unavailable private images", async () => {
  const recipes = [
    demoRecipes[0],
    { ...demoRecipes[0], id: "second", title: "Une deuxième fiche" },
  ];
  const bytes = await buildRecipePdf(
    recipes,
    demoIngredients,
    defaultUnits,
    "fr",
    async () => {
      throw new Error("unexpected image");
    },
  );
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(4);
  expect(pdf.getPages().map((p) => p.getSize())).toEqual(
    Array(4).fill({ width: 612, height: 792 }),
  );
  expect(pdf.getTitle()).toBe("Mon livre de recettes");
  await expect(
    buildRecipePdf(
      [{ ...demoRecipes[0], image: "/api/recipe-images/private" }],
      demoIngredients,
      defaultUnits,
      "fr",
      async () => {
        throw new Error("image_unavailable");
      },
    ),
  ).rejects.toThrow("image_unavailable");
});

test("individual, selected and weekly recipe PDFs download from their own entry points", async ({
  page,
}) => {
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Mes recettes", exact: true }).click();
  const selection = page.getByRole("button", {
    name: "Exporter la sélection en PDF",
    exact: true,
  });
  await expect(selection).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "Sélectionner Bœuf et oignons",
      exact: true,
    })
    .check();
  let downloading = page.waitForEvent("download");
  await selection.click();
  let file = await downloading;
  expect(
    (
      await PDFDocument.load(await readFile((await file.path())!))
    ).getPageCount(),
  ).toBe(2);
  await page.locator(".recipe-open").click();
  downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Télécharger la fiche PDF", exact: true })
    .click();
  file = await downloading;
  expect(file.suggestedFilename()).toBe("iamable-demo-beef-fr.pdf");
  const single = await PDFDocument.load(await readFile((await file.path())!));
  expect(single.getTitle()).toBe("Bœuf et oignons");
  expect(single.getPageCount()).toBe(2);
  await page.getByRole("button", { name: /Fermer/ }).click();
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  const weekly = page.getByRole("button", {
    name: "Les recettes en PDF",
    exact: true,
  });
  await expect(weekly).toBeDisabled();
  for (let i = 0; i < 2; i++) {
    await page.locator(".empty-slot").first().click();
    await page
      .getByRole("button", { name: "Choisir cette recette", exact: true })
      .click();
  }
  downloading = page.waitForEvent("download");
  await weekly.click();
  file = await downloading;
  // A repeated meal contributes quantities twice but its recipe card only once.
  expect(
    (
      await PDFDocument.load(await readFile((await file.path())!))
    ).getPageCount(),
  ).toBe(2);
});
