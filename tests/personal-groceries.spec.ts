import { test, expect } from "@playwright/test";
import { selectAppOption } from "./select-helper";
import { demoData } from "../src/lib/demo";
import { applyShoppingMutation, shoppingNeeds, shoppingState, shoppingPurchaseLine, periodKey } from "../src/lib/shopping";
import { applyPrivateMutation } from "../src/lib/private-mutations";
import { ShoppingSelectionQueue } from "../src/lib/shopping-selection";
import { createVault, decryptVault } from "../src/lib/vault-crypto";
import { pantryAisle } from "../src/lib/pantry";
import type { ShoppingWorkspace } from "../src/lib/shopping-types";

const range = { start: "2026-10-21", end: "2026-10-27" };
function base(): ShoppingWorkspace { return { ...structuredClone(demoData), pantry: [], slots: [] }; }
const food = () => ({ id: crypto.randomUUID(), name: "Yogourt nature", aisle: "dairy", quantity: { kind: "volume", value: 500 } });
const needs = (data: ShoppingWorkspace) => shoppingNeeds(data, data, range.start, range.end).items;

test("personal food persists privately without a recipe, receives partial quantities once, and returns after cancellation", async () => {
  let data = applyShoppingMutation(base(), { action: "personalItem", item: food() }, base());
  expect(needs(data)).toHaveLength(1);
  expect(shoppingNeeds(data, data, "2027-03-01", "2027-03-31").items).toHaveLength(1);
  const id = crypto.randomUUID(), lines = needs(data).map(shoppingPurchaseLine);
  data = applyShoppingMutation(data, { action: "order", id, mode: "online", grocer: "Mon épicier", expectedDate: "2027-01-30", fulfillment: "delivery", lines }, data);
  expect(needs(data)[0]).toMatchObject({ quantity: { value: 0 }, pending: 500 }); expect(data.pantry).toHaveLength(0);
  const cancelled = applyShoppingMutation(data, { action: "cancel", id }, data);
  expect(needs(cancelled)[0].quantity.value).toBe(500);
  const receipt = { action: "receive", id, lines: [{ ...lines[0], quantity: { kind: "volume", value: 300 } }] };
  data = applyShoppingMutation(data, receipt, data);
  expect(data.pantry[0].quantity?.value).toBe(300); expect(pantryAisle(data.pantry[0], [])).toBe("dairy");
  expect(needs(data)[0].quantity.value).toBe(200);
  expect(applyShoppingMutation(data, receipt, data).pantry[0].quantity?.value).toBe(300);
  const stock = JSON.parse(JSON.stringify(data));
  expect(needs(stock)[0].quantity.value).toBe(200);
  const vault = await createVault("synthetic-owner", "Long synthetic password only for testing 2026!", { ...data, program: { completed: {}, reflections: {} } });
  expect(JSON.stringify(vault.envelope)).not.toContain("Yogourt");
  const opened = await decryptVault<ShoppingWorkspace>(vault.key, vault.envelope, "synthetic-owner");
  expect(needs(opened)[0].quantity.value).toBe(200);
  const remainder = needs(data).map(shoppingPurchaseLine);
  data = { ...data, ...applyPrivateMutation({ ...data, program: { completed: {}, reflections: {} } }, "shopping", { action: "order", id: crypto.randomUUID(), mode: "store", grocer: "", expectedDate: range.start, fulfillment: "pickup", lines: remainder }, data) };
  expect(data.pantry[0].quantity?.value).toBe(500); expect(needs(data)[0].quantity.value).toBe(0);
  data.pantry[0].inStock = false;
  expect(needs(data)[0].quantity.value).toBe(0); // buying goal is fulfilled, even when food is later used
});

test("rapid selections are immediate, coalesce safely and recover after a failed write", async () => {
  let data = base(), release: () => void = () => {}, fail = false;
  const writes: object[] = [];
  const queue = new ShoppingSelectionQueue(async mutation => {
    writes.push(mutation);
    if (writes.length === 1) await new Promise<void>(r => { release = r; });
    if (fail) throw Error("offline");
    data = applyShoppingMutation(data, mutation, data);
  });
  queue.select(range, ["one"], true);
  queue.select(range, ["two"], true);
  queue.select(range, ["one"], false);
  queue.select(range, ["three"], true);
  expect(queue.selected(range, [])).toEqual(["two", "three"]);
  expect(writes).toHaveLength(1);
  release(); await queue.flush();
  expect(shoppingState(data).selections[periodKey(range.start, range.end)].sort()).toEqual(["three", "two"]);
  expect(writes).toHaveLength(2);
  fail = true; queue.select(range, ["one", "two", "three"], true); await queue.flush();
  expect(queue.snapshot.error).toBe(true);
  expect(queue.selected(range, []).sort()).toEqual(["one", "three", "two"]);
  fail = false; await queue.flush();
  expect(queue.snapshot.error).toBe(false);
  expect(shoppingState(data).selections[periodKey(range.start, range.end)].sort()).toEqual(["one", "three", "two"]);
  queue.select(range, ["one", "two", "three"], false); await queue.flush();
  expect(shoppingState(data).selections[periodKey(range.start, range.end)]).toEqual([]);
});

test("personal grocery form, themed picker, select-all and receipt work on desktop and phone", async ({ page }) => {
  await page.goto("/fr/demo");
  await page.getByRole("navigation").getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
  for (const name of ["Yogourt maison", "Granola maison"]) {
    await page.getByRole("button", { name: "Ajouter un aliment", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Mesure", { exact: true })).toHaveAttribute("data-value", "volume");
    await dialog.getByLabel("Nom de l’aliment", { exact: true }).fill(name);
    await selectAppOption(dialog.getByRole("combobox", { name: "Rayon", exact: true }), name.includes("Yogourt") ? "dairy" : "dry");
    await dialog.getByLabel("Quantité", { exact: true }).fill("500");
    if (name.includes("Yogourt")) for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const combo = dialog.getByRole("combobox", { name: "Rayon", exact: true });
      await combo.click();
      const picker = page.getByRole("listbox", { name: "Options", exact: true });
      await expect(picker).toBeVisible();
      const bounds = (await picker.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
      await page.screenshot({ path: `artifacts/grocery-picker-${width}.png` });
      await combo.press("Escape"); await expect(dialog).toBeVisible();
      await expect(picker).not.toBeVisible();
      expect(await page.evaluate(() => [...document.querySelectorAll("body *")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(el).position !== "fixed"; }).map(el => `${el.tagName}.${el.className}`).slice(0,12))).toEqual([]);
    }
    await dialog.getByRole("button", { name: "Ajouter à ma liste", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const all = page.getByRole("checkbox", { name: "Tout sélectionner", exact: true });
  await all.check();
  await expect(page.getByRole("checkbox", { name: "Cocher Yogourt maison" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Cocher Granola maison" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Cocher Granola maison" }).uncheck();
  await expect(all).toBeChecked({ indeterminate: true });
  await all.check(); await all.uncheck();
  await expect(page.getByRole("checkbox", { name: "Cocher Yogourt maison" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Cocher Yogourt maison" }).check();
  await page.getByRole("button", { name: "Ranger mes achats", exact: true }).click();
  const receipt = page.getByRole("dialog");
  await expect(receipt).toContainText("Yogourt maison"); await expect(receipt).not.toContainText("Granola maison");
  await receipt.getByRole("button", { name: "Confirmer et ajouter aux réserves", exact: true }).click();
  await expect(page.locator(".grocery-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Voir mes réserves", exact: true }).click();
  const dairy = page.getByRole("region", { name: "Produits laitiers et œufs", exact: true });
  await expect(dairy).toContainText("Yogourt maison"); await expect(dairy).toContainText("500 ml");
});
