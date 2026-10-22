import { test, expect } from "@playwright/test";
import { prepareReceipt, receiptQuantity } from "../src/lib/receipt";
import { applyShoppingMutation, shoppingNeeds } from "../src/lib/shopping";
import { demoData } from "../src/lib/demo";
import type { Purchase, ShoppingWorkspace } from "../src/lib/shopping-types";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as receiptModule from "../src/lib/receipt";
import * as http from "../src/lib/private-http";

const item = (extra = {}) => ({ name: "Bœuf haché extra maigre", source: "4 x bœuf 500 g", ingredientId: "beef-95-raw", orderLineIndex: 0, packs: 4, amount: 500, unit: "g", countLabel: "", packageLabel: "4 × 500 g", location: "fridge", aisle: "meat", review: "", ...extra });
const order: Purchase = { id: "11111111-1111-4111-8111-111111111111", mode: "online", grocer: "Épicier test", expectedDate: "2026-10-23", fulfillment: "delivery", status: "pending", createdAt: "2026-10-22", lines: [{ ingredientId: "beef-95-raw", quantity: { kind: "count", value: 4, label: "paquets" }, location: "fridge" }, { ingredientId: "onion-raw", quantity: { kind: "mass", value: 100 }, location: "fridge" }] };

test("receipt package arithmetic, imperial units and missing formats never invent stock", () => {
  const result = prepareReceipt({ items: [item(), item({ name: "Ail", source: "40 gousses", ingredientId: null, orderLineIndex: null, packs: 1, amount: 40, unit: "count", countLabel: "gousses" }), item({ name: "Pâtes", source: "1 paquet de pâtes", ingredientId: null, orderLineIndex: null, packs: 1, amount: null, unit: "g" })], note: "" }, "4 x bœuf 500 g\n40 gousses\n1 paquet de pâtes", order, demoData.ingredients, "fr");
  expect(result.items[0].line.quantity).toEqual({ kind: "mass", value: 2000 });
  expect(result.items[1].line.quantity).toMatchObject({ kind: "count", value: 40, label: "gousses" });
  expect(result.items[2]).toMatchObject({ needsQuantity: true, line: { quantity: { value: 0 } } });
  expect(result.items[2].review).toBeTruthy();
  expect(receiptQuantity(12, "oz", 4).value).toBeCloseTo(1360.77711, 4);
  expect(receiptQuantity(1, "l", 2)).toEqual({ kind: "volume", value: 2000 });
  expect(() => prepareReceipt({ items: [item({ source: "not in receipt" })], note: "" }, "4 x bœuf 500 g", order, demoData.ingredients, "fr")).toThrow("ungrounded_item");
  expect(() => prepareReceipt({ items: [item({ ingredientId: "made-up-id" })], note: "" }, "4 x bœuf 500 g", order, demoData.ingredients, "fr")).toThrow("unknown_ingredient");
  expect(() => receiptQuantity(1000000, "kg")).toThrow();
  expect(() => prepareReceipt({ items: [item(), item()], note: "" }, "4 x bœuf 500 g", order, demoData.ingredients, "fr")).toThrow("duplicate_item");
});

test("reviewed receipt replaces actual contents, preserves planned order, and adds stock exactly once", () => {
  const base: ShoppingWorkspace = { ...structuredClone(demoData), pantry: [], shopping: { grocers: [], orders: [structuredClone(order)], selections: {}, cooked: [] } };
  const before = JSON.stringify(base);
  const lines = prepareReceipt({ items: [item(), item({ name: "Granola reçu", source: "Granola 750 g", ingredientId: null, orderLineIndex: null, packs: 1, amount: 750, location: "cupboard", aisle: "dry" })], note: "Oignons non reçus" }, "4 x bœuf 500 g\nGranola 750 g", order, base.ingredients, "fr").items.map(i => i.line);
  const input = { action: "receiveActual", id: order.id, lines };
  const next = applyShoppingMutation(base, input, base);
  expect(next.shopping!.orders[0].lines).toEqual(order.lines);
  expect(next.shopping!.orders[0].received).toEqual(lines);
  expect(next.pantry).toHaveLength(2);
  expect(next.pantry.find(p => p.ingredientId === "beef-95-raw")?.quantity?.value).toBe(2000);
  expect(next.pantry.some(p => p.ingredientId === "onion-raw")).toBe(false);
  expect(next.pantry.find(p => p.name === "Granola reçu")?.quantity?.value).toBe(750);
  expect(applyShoppingMutation(next, input, base)).toBe(next);
  expect(JSON.stringify(base)).toBe(before);
  expect(() => applyShoppingMutation(base, { ...input, id: crypto.randomUUID() }, base)).toThrow("order_unavailable");
  expect(() => applyShoppingMutation(base, { ...input, lines: [{ ...lines[0], ingredientId: "unknown" }] }, base)).toThrow("invalid_receipt");
  expect(() => applyShoppingMutation(base, { ...input, lines: [{ ...lines[0], personalItemId: crypto.randomUUID() }] }, base)).toThrow("invalid_personal_item");
  const empty = applyShoppingMutation(base, { ...input, lines: [] }, base);
  expect(empty.pantry).toHaveLength(0); expect(empty.shopping!.orders[0].status).toBe("received");
  const planned = { ...base, slots: [{ date: "2026-10-24", slot: "dinner" as const, recipeId: base.recipes[0].id }] };
  const received = applyShoppingMutation(planned, input, base);
  expect(shoppingNeeds(received, base, "2026-10-24", "2026-10-24").items.find(i => i.ingredient.id === "onion-raw")?.quantity.value).toBe(100);
});

test("receipt API verifies owner, origin, vault and quota; previews never write stock or send journals", async () => {
  const require = createRequire(process.cwd() + "/package.json");
  let authorized = true, origin = true, vault = false, exists = true, permitted = true, calls = 0;
  let output: unknown = { items: [item()], note: "" };
  let imagePayload: string[] = [];
  const queries: string[] = [];
  const db = { from: (table: string) => {
    const query = { select: (columns: string) => { queries.push(`${table}:${columns}`); return query; }, eq: (column: string, value: string) => { expect(column).toBe("owner_id"); expect(value).toBe("owner"); return query; }, maybeSingle: async () => ({ data: table === "personal_vaults" ? vault ? { revision: 1 } : null : { shopping: { orders: exists ? [order] : [] } }, error: null }), then: (resolve: (value: unknown) => unknown) => resolve({ data: demoData.ingredients.map(i => ({ id: i.id, details: i })), error: null }) }; return query;
  }, rpc: async (name: string) => { expect(name).toBe("reserve_ai_edit"); return { data: permitted, error: null }; } };
  const route: { POST?: (r: Request) => Promise<Response> } = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("src/app/api/shopping/receipt/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: route, require: (name: string) => {
    if (name.endsWith("/supabase")) return { authorizedClient: async () => authorized ? { db, user: { id: "owner" } } : null };
    if (name.endsWith("/security")) return { sameOrigin: () => origin };
    if (name.endsWith("/private-http")) return http;
    if (name.endsWith("/receipt")) return receiptModule;
    if (name.endsWith("/fireworks")) return { requirePrivateFireworks: async (id: string) => expect(id).toBe("owner"), fireworksText: async (_: string, input: any, privateData: boolean, json: boolean, id: string, options: any) => { calls++; imagePayload = options.images; expect(privateData).toBe(true); expect(json).toBe(true); expect(id).toBe("owner"); expect(Object.keys(input).sort()).toEqual(["catalog", "expected", "locale", "receipt"]); return JSON.stringify(output); } };
    return require(name);
  } });
  const request = (payload: unknown = { orderId: order.id, text: "4 x bœuf 500 g", locale: "fr" }) => new Request("https://tredmeal.com/api/shopping/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const post = (payload?: unknown) => route.POST!(request(payload));
  origin = false; expect((await post()).status).toBe(403); origin = true;
  authorized = false; expect((await post()).status).toBe(401); authorized = true;
  vault = true; expect((await post()).status).toBe(409); vault = false;
  exists = false; expect((await post()).status).toBe(404); exists = true;
  permitted = false; expect((await post()).status).toBe(429); permitted = true;
  expect((await post({ orderId: order.id, text: "", locale: "fr" })).status).toBe(400);
  expect(calls).toBe(0);
  const response = await post(); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect((await response.json()).items[0].line.quantity.value).toBe(2000);
  expect(queries).toContain("standard_workspaces:shopping:data->shopping");
  expect(queries.some(q => /journal|data,|\*/.test(q))).toBe(false);
  output = { items: [item({ source: "invented" })], note: "" }; expect((await post()).status).toBe(502);
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=";
  const invalidBefore = calls;
  for (const images of [["https://private.example/receipt.png"], ["data:image/svg+xml;base64,PHN2Zz4="], [pixel.repeat(20000)], [pixel, pixel, pixel, pixel], ["data:image/png;base64,YWJj"]]) {
    expect((await post({ orderId: order.id, images, locale: "fr" })).status).toBe(400);
  }
  expect(calls).toBe(invalidBefore);
  output = { items: [item()], note: "", transcription: "4 x bœuf 500 g" };
  const photo = await post({ orderId: order.id, images: [pixel], locale: "fr" });
  expect(photo.status).toBe(200); expect(imagePayload).toEqual([pixel]);
  const photoBody = await photo.json(); expect(photoBody.items[0].line.quantity.value).toBe(2000);
  expect(JSON.stringify(photoBody)).not.toContain("base64");
  output = { items: [item()], note: "", transcription: "unrelated text" };
  expect((await post({ orderId: order.id, images: [pixel], locale: "fr" })).status).toBe(502);
});

test("pasted receipt is reviewed, can recover from AI error, and updates pantry plus receipt history", async ({ page }) => {
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await page.getByRole("button", { name: "Commander en ligne", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "J’ai passé ma commande", exact: true }).click();
  await page.getByRole("button", { name: "J’ai reçu ma commande", exact: true }).click();
  await expect(dialog.getByLabel("Ce que j’ai reçu", { exact: true })).toBeVisible();
  const pasted = "4 x bœuf 500 g\nPâtes artisanales";
  await dialog.getByLabel("Ce que j’ai reçu", { exact: true }).fill(pasted);
  let fail = true;
  await page.route("**/api/shopping/receipt", async route => {
    expect(route.request().postDataJSON().text).toBe(pasted);
    if (fail) return route.fulfill({ status: 503, json: { error: "unavailable" } });
    return route.fulfill({ json: prepareReceipt({ items: [item(), item({ name: "Pâtes artisanales", source: "Pâtes artisanales", ingredientId: null, orderLineIndex: null, amount: null, packs: 1, review: "Quel est le poids du paquet?", location: "cupboard", aisle: "dry" })], note: "" }, pasted, order, demoData.ingredients, "fr") });
  });
  await dialog.getByRole("button", { name: "Préparer ma réception" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Ce que j’ai reçu", { exact: true })).toHaveValue(pasted);
  fail = false;
  await dialog.getByRole("button", { name: "Préparer ma réception" }).click();
  await expect(dialog.getByLabel("Quantité Bœuf haché extra maigre", { exact: true })).toHaveValue("2000");
  const save = dialog.getByRole("button", { name: "Confirmer et ajouter aux réserves", exact: true });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Quantité Pâtes artisanales", { exact: true }).fill("750");
  await dialog.getByRole("checkbox", { name: "J’ai vérifié cet article" }).check();
  await expect(save).toBeEnabled();
  await page.screenshot({ path: "artifacts/receipt-review-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await dialog.locator("input:not([type=checkbox])").evaluateAll(inputs => inputs.every(i => parseFloat(getComputedStyle(i).fontSize) >= 16))).toBe(true);
  await page.screenshot({ path: "artifacts/receipt-review-mobile.png" });
  await save.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".pending-order")).toHaveCount(0);
  await page.locator(".received-orders>summary").click();
  await page.locator(".received-orders>details>summary").click();
  await expect(page.locator(".received-orders")).toContainText("750 g");
  await page.setViewportSize({ width: 1280, height: 900 });
  await nav.getByRole("button", { name: "Mes réserves", exact: true }).click();
  await expect(page.getByRole("region", { name: "Épicerie sèche et conserves", exact: true })).toContainText("Pâtes artisanales");
  await expect(page.locator(".pantry-groups")).toContainText("2 000 g");
});

test("receipt photo works alone; errors, cancellation and timeout preserve attachments without updating stock", async ({ page }) => {
  // An original synthetic fixture, also usable for the real vision smoke test.
  await page.setContent(`<main style="width:650px;padding:42px;background:white;color:#111;font:22px/1.6 monospace"><h1>RECU DE TEST</h1><p>Exemple fictif — aucune commande reelle</p><hr><p>4 x Boeuf hache extra maigre - 500 g</p><p>2 x Lait 2% - 1 L</p><p>1 x Oeufs - boite de 12</p><p>1 x Spaghetti - format non precise</p><hr><p>Tomates : annulees / non livrees</p><p>Frais livraison : 5,00 $</p></main>`);
  const photo = await page.locator("main").screenshot({ path: "artifacts/synthetic-receipt.png" });
  await page.goto("/fr/demo");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await nav.getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  await page.getByRole("button", { name: "Commander en ligne", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "J’ai passé ma commande", exact: true }).click();
  await page.getByRole("button", { name: "J’ai reçu ma commande", exact: true }).click();
  const upload = dialog.getByLabel("Photos du reçu", { exact: true });
  await upload.setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(dialog.getByRole("alert")).toContainText("ne peut pas être lue");
  await upload.setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: photo });
  await expect(dialog.getByAltText("Reçu 1", { exact: true })).toBeVisible();
  const prepare = dialog.getByRole("button", { name: "Préparer ma réception", exact: true });
  await expect(prepare).toBeEnabled();
  await expect(dialog.getByLabel("Ce que j’ai reçu", { exact: true })).toHaveValue("");
  let mode: "hang" | "error" | "success" = "hang";
  let release: (() => void) | undefined;
  await page.route("**/api/shopping/receipt", async route => {
    const payload = route.request().postDataJSON();
    expect(payload.text).toBe(""); expect(payload.images).toHaveLength(1);
    expect(payload.images[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(payload.images[0].length).toBeLessThanOrEqual(receiptModule.receiptImageLimit);
    if (mode === "hang") { await new Promise<void>(resolve => { release = resolve; }); return route.abort().catch(() => {}); }
    if (mode === "error") return route.fulfill({ status: 503, json: { error: "ai_unavailable" } });
    return route.fulfill({ json: prepareReceipt({ items: [item()], note: "" }, "4 x bœuf 500 g", order, demoData.ingredients, "fr") });
  });
  await prepare.click(); await expect(dialog.getByRole("status")).toContainText("Lecture");
  await dialog.getByRole("button", { name: "Arrêter", exact: true }).click();
  release?.(); await expect(prepare).toBeEnabled();
  await expect(dialog.getByRole("alert")).toContainText("Analyse arrêtée");
  await expect(dialog.getByAltText("Reçu 1", { exact: true })).toBeVisible();
  // Advance only the test clock; a stalled connection must return control.
  await page.clock.install();
  await prepare.click(); await expect(dialog.getByRole("status")).toBeVisible();
  await page.clock.fastForward(166000);
  await expect(dialog.getByRole("alert")).toContainText("prend trop de temps");
  release?.(); await expect(prepare).toBeEnabled();
  mode = "error";
  await prepare.click(); await expect(dialog.getByRole("alert")).toContainText("Rien n’a été ajouté");
  await expect(dialog.getByAltText("Reçu 1", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/receipt-photo-retry.png" });
  mode = "success";
  await prepare.click(); await expect(dialog.getByLabel("Quantité Bœuf haché extra maigre", { exact: true })).toHaveValue("2000");
  await dialog.getByRole("button", { name: "Revenir au reçu", exact: true }).click();
  await expect(dialog.getByAltText("Reçu 1", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Retirer la photo 1", exact: true }).click();
  await expect(prepare).toBeDisabled();
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.locator(".pending-order")).toHaveCount(1);
});
