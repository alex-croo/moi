import { test, expect } from "@playwright/test";
import { handleInstacart } from "../src/lib/instacart-server";
import { instacartMeasurement, isInstacartLink } from "../src/lib/instacart";
import { preferredGrocer } from "../src/lib/grocer-preferences";
import { applyShoppingMutation, shoppingState } from "../src/lib/shopping";
import { demoIngredients, demoRecipes } from "../src/lib/demo-recipes";
import { defaultUnits } from "../src/lib/units";
import type { Grocer, ShoppingWorkspace } from "../src/lib/shopping-types";

const origin = "https://iamable.space";
const request = (body: unknown, requestOrigin = origin) => new Request(`${origin}/api/shopping/instacart`, { method: "POST", headers: { origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const config = { key: "test-only-key", environment: "development" as const };
const example = { action: "export", locale: "fr", items: [{ name: "Bœuf", quantity: { kind: "mass", value: 750 } }, { name: "Huile", quantity: { kind: "spoon", value: 15 } }] };

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

test("export refuses anonymous/cross-origin requests and missing configuration before reading groceries", async () => {
  for (const mode of ["anonymous", "origin", "config", "auth-error"]) {
    let calls = 0, reads = 0;
    const req = request({}, mode === "origin" ? "https://other.test" : origin);
    Object.defineProperty(req, "body", { get: () => { reads++; throw Error("must not read"); } });
    const response = await handleInstacart(req, { origin, config: mode === "config" ? null : config, authorize: async () => { if (mode === "auth-error") throw Error("db"); return mode !== "anonymous"; }, fetcher: async () => { calls++; throw Error("must not call"); } });
    expect(response.status).toBe(mode === "anonymous" ? 401 : mode === "origin" ? 403 : 503);
    expect(reads).toBe(0); expect(calls).toBe(0);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
});

test("export sends canonical quantities without personal profile, prices or credentials in its response", async () => {
  let sent: Record<string, unknown> = {};
  const response = await handleInstacart(request(example), { origin, config, authorize: async () => true, fetcher: async (url, init) => {
    expect(String(url)).toBe("https://connect.dev.instacart.tools/idp/v1/products/products_link");
    sent = JSON.parse(init!.body as string);
    expect(init!.headers).toMatchObject({ "Accept-Language": "fr-CA", Authorization: "Bearer test-only-key" });
    expect(init!.redirect).toBe("error");
    return Response.json({ products_link_url: "https://www.instacart.com/store/shopping_lists/test" });
  } });
  expect(response.status).toBe(200);
  expect(sent.line_items).toEqual([
    { name: "Bœuf", display_text: "Bœuf — 750 g", line_item_measurements: [{ quantity: 750, unit: "gram" }] },
    { name: "Huile", display_text: "Huile — 15 ml", line_item_measurements: [{ quantity: 15, unit: "milliliter" }] },
  ]);
  expect(Object.keys(sent).sort()).toEqual(["expires_in", "line_items", "link_type", "title"]);
  expect(await response.json()).toEqual({ url: "https://www.instacart.com/store/shopping_lists/test", development: true });
  expect(instacartMeasurement({ kind: "count", value: 3, label: "gousses" })).toBeUndefined();
  expect(instacartMeasurement({ kind: "count", value: 2, labelEn: "cans" })).toEqual([{ quantity: 2, unit: "can" }]);
});

test("retailers use CA and normalized postal code; errors and unsafe links never leak upstream content", async () => {
  const lookup = await handleInstacart(request({ action: "retailers", locale: "fr", postalCode: "h2x1y4" }), { origin, config, authorize: async () => true, fetcher: async (url, init) => {
    const u = new URL(String(url)); expect(u.searchParams.get("country_code")).toBe("CA"); expect(u.searchParams.get("postal_code")).toBe("H2X 1Y4"); expect(init!.body).toBeUndefined();
    return Response.json({ retailers: [{ name: "Test", retailer_key: "test", retailer_logo_url: "unused" }] });
  } });
  expect(await lookup.json()).toEqual({ retailers: [{ name: "Test", retailer_key: "test" }], development: true });
  for (const value of ["https://instacart.com.evil.test/path", "javascript:alert(1)", "https://user:secret@instacart.com", "http://instacart.ca"]) {
    expect(isInstacartLink(value)).toBe(false);
    const response = await handleInstacart(request(example), { origin, config, authorize: async () => true, fetcher: async () => Response.json({ products_link_url: value }) });
    expect(response.status).toBe(502);
  }
  const failure = await handleInstacart(request(example), { origin, config, authorize: async () => true, fetcher: async () => { throw Error("secret upstream body"); } });
  expect(await failure.text()).not.toContain("secret");
  let calls = 0;
  const invalid = await handleInstacart(request({ ...example, journal: "private" }), { origin, config, authorize: async () => true, fetcher: async () => { calls++; return Response.json({}); } });
  expect(invalid.status).toBe(400); expect(calls).toBe(0);
});

test("portal groups by preferred supplier, exports only chosen items and never creates a purchase automatically", async ({ page }) => {
  const exports: unknown[] = [];
  await page.route("**/api/shopping/instacart", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true } });
    exports.push(route.request().postDataJSON());
    return route.fulfill({ json: { url: "https://www.instacart.com/store/shopping_lists/test", development: true } });
  });
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  for (const [name, category] of [["Épicerie du quartier", "Fruits et légumes"], ["Mon boucher", "Bœuf"]]) {
    await page.getByRole("button", { name: "Ajouter un épicier", exact: true }).click();
    await page.getByLabel("Nom de l’épicier", { exact: true }).fill(name);
    await page.getByRole("checkbox", { name: category, exact: true }).check();
    await page.getByRole("button", { name: "Enregistrer l’épicier", exact: true }).click();
  }
  await page.getByLabel("Mon code postal", { exact: true }).fill("h2x1y4");
  await page.getByRole("button", { name: "Enregistrer le code postal", exact: true }).click();
  await expect(page.getByLabel("Mon code postal", { exact: true })).toHaveValue("H2X 1Y4");
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await page.getByRole("button", { name: "Acheter avec Instacart", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const grouping = dialog.getByRole("combobox", { name: "Articles à exporter", exact: true });
  const supplier = await grouping.locator("option").filter({ hasText: "Mon boucher" }).getAttribute("value");
  await grouping.selectOption(supplier!);
  await expect(dialog.locator(".instacart-items li")).toHaveCount(1);
  await expect(dialog).toContainText("Bœuf haché extra maigre");
  for (const [width, height, label] of [[1280,800,"galaxy-tab"],[390,844,"iphone"],[412,915,"android-phone"],[1024,768,"ipad"]] as const) {
    await page.setViewportSize({ width, height });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/instacart-${label}.png`, fullPage: true });
  }
  await dialog.getByRole("button", { name: "Créer ma liste Instacart", exact: true }).click();
  await expect(dialog.getByRole("link", { name: "Continuer sur Instacart ↗" })).toHaveAttribute("href", "https://www.instacart.com/store/shopping_lists/test");
  expect(exports).toHaveLength(1);
  expect(exports[0]).toMatchObject({ items: [{ name: "Bœuf haché extra maigre", quantity: { kind: "mass", value: 250 } }] });
  await dialog.getByRole("button", { name: "Fermer", exact: true }).last().click();
  await expect(page.locator(".pending-order")).toHaveCount(0);
  await expect(page.locator(".grocery-item")).toHaveCount(2);
});

test("anonymous demo explains missing connection without sending a list", async ({ page, request: api, baseURL }) => {
  const direct = await api.post("/api/shopping/instacart", { headers: { origin: new URL(baseURL!).origin }, data: example });
  expect(direct.status()).toBe(401);
  await page.goto("/en/demo");
  await page.getByRole("navigation").getByRole("button", { name: "My menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choose this recipe", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Grocery list", exact: true }).click();
  await page.getByRole("button", { name: "Shop with Instacart", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Instacart export requires your signed-in workspace");
  await expect(dialog.getByRole("button", { name: "Create my Instacart list", exact: true })).toBeDisabled();
});
