import { test, expect } from "@playwright/test";
import { preferredGrocer } from "../src/lib/grocer-preferences";
import { applyShoppingMutation, shoppingState } from "../src/lib/shopping";
import { demoIngredients, demoRecipes } from "../src/lib/demo-recipes";
import { defaultUnits } from "../src/lib/units";
import type { Grocer, ShoppingWorkspace } from "../src/lib/shopping-types";

test("supplier preferences survive private mutations and beef takes precedence over meat and default", () => {
  const grocers: Grocer[] = [
    { id: crypto.randomUUID(), name: "Épicerie", url: "", favorite: true, fulfillment: "delivery" },
    { id: crypto.randomUUID(), name: "Boucher", url: "", favorite: false, fulfillment: "pickup", categories: ["meat"] },
    { id: crypto.randomUUID(), name: "Ferme bovine", url: "", favorite: false, fulfillment: "pickup", categories: ["beef"] },
  ];
  let data: ShoppingWorkspace = { recipes: demoRecipes, ingredients: demoIngredients, pantry: [], slots: [], groceryChecks: [], preferences: defaultUnits, plans: [], journal: [], weights: [], documents: [] };
  data = applyShoppingMutation(data, { action: "grocers", grocers }, data);
  data = applyShoppingMutation(data, { action: "postalCode", postalCode: "h2x1y4" }, data);
  expect(shoppingState(data).postalCode).toBe("H2X 1Y4");
  const beef = demoIngredients.find(i => i.id === "beef-95-raw")!;
  expect(preferredGrocer(beef, shoppingState(data).grocers)?.name).toBe("Ferme bovine");
  expect(preferredGrocer(beef, grocers.slice(0, 2))?.name).toBe("Boucher");
  expect(preferredGrocer(beef, grocers.slice(0, 1))?.name).toBe("Épicerie");
  expect(preferredGrocer(beef, [])).toBeUndefined();
  expect(() => applyShoppingMutation(data, { action: "grocers", grocers: [grocers[2], { ...grocers[1], categories: ["beef"] }] }, data)).toThrow();
  expect(() => applyShoppingMutation(data, { action: "postalCode", postalCode: "bad" }, data)).toThrow();
});


test("saved grocers and manual orders remain available without Instacart UI or requests", async ({ page, request }) => {
  const calls: string[] = [];
  page.on("request", r => { if (/instacart/i.test(r.url())) calls.push(r.url()); });
  await page.goto("/fr/demo");
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  await expect(page.getByText(/Instacart/)).toHaveCount(0);
  await page.getByRole("button", { name: "Ajouter un épicier", exact: true }).click();
  await page.getByLabel("Nom de l’épicier", { exact: true }).fill("Mon épicier");
  await page.getByLabel("Site Web (facultatif)", { exact: true }).fill("https://example.com");
  await page.getByRole("button", { name: "Enregistrer l’épicier", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter un aliment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom de l’aliment", { exact: true }).fill("Riz personnel");
  await dialog.getByLabel("Quantité", { exact: true }).fill("500");
  const measure = dialog.getByRole("combobox", { name: "Mesure", exact: true });
  await measure.press("ArrowDown"); await measure.press("ArrowDown"); await measure.press("Enter");
  await expect(measure).toHaveAttribute("data-value", "mass");
  await dialog.getByLabel("Quantité", { exact: true }).fill("500");
  await dialog.getByRole("button", { name: "Ajouter à ma liste", exact: true }).click();
  await page.getByRole("button", { name: "Commander en ligne", exact: true }).click();
  await expect(dialog).not.toContainText("Instacart");
  await expect(dialog.getByRole("link", { name: "Ouvrir la boutique ↗" })).toHaveAttribute("href", "https://example.com");
  await expect(page.locator(".pending-order")).toHaveCount(0);
  await dialog.getByRole("button", { name: "J’ai passé ma commande", exact: true }).click();
  await expect(page.locator(".pending-order")).toHaveCount(1);
  await page.getByRole("button", { name: "J’ai reçu ma commande", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmer et ajouter aux réserves", exact: true }).click();
  await page.getByRole("button", { name: "Voir mes réserves", exact: true }).click();
  await expect(page.locator(".pantry-group li").filter({ hasText: "Riz personnel" })).toContainText("500 g");
  expect(calls).toEqual([]);
  const retired = await request.get("/api/shopping/instacart");
  expect(retired.status()).toBe(404);
});
