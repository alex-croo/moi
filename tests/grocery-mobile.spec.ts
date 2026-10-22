import { selectAppOption } from "./select-helper";
import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });

async function planGroceries(page: Page) {
  await page.getByRole("navigation").getByRole("button", { name: "Mes menus", exact: true }).click();
  await page.locator(".empty-slot").first().click();
  await page.getByRole("button", { name: "Choisir cette recette", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Liste d’épicerie", exact: true }).click();
}

async function assertDialogFits(page: Page, width: number, height: number, top = 0) {
  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(11);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width - 11);
  expect(box!.y).toBeGreaterThanOrEqual(top + 11);
  expect(box!.y + box!.height).toBeLessThanOrEqual(top + height - 11);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
}

test("mobile pantry shortcut defaults to volume, respects units and stays inside narrow screens", async ({ page }) => {
  await page.goto("/fr/demo");
  await page.getByRole("button", { name: "Préférences", exact: true }).click();
  await selectAppOption(page.getByLabel("Volumes et liquides", { exact: true }), "cup");
  await expect(page.getByLabel("Volumes et liquides", { exact: true })).toBeEnabled();
  await planGroceries(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const shortcut = page.getByRole("button", { name: "Déjà en réserve : Oignon", exact: true });
  await expect(shortcut).toBeVisible();
  const target = await shortcut.boundingBox();
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Options pour Oignon", exact: true })).toBeHidden();
  await shortcut.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Mesure", exact: true })).toHaveAttribute("data-value", "volume");
  const amount = dialog.getByLabel("Quantité en réserve · tasses US", { exact: true });
  // A recipe's required grams must never be silently relabelled as millilitres/cups.
  await expect(amount).toHaveValue("");
  await expect(amount).toHaveAttribute("inputmode", "decimal");
  await amount.fill("1.5");
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => dialog.evaluate(el => el.style.getPropertyValue("--dialog-width"))).toBe(`${width}px`);
    await assertDialogFits(page, width, height);
    const sizes = await dialog.locator("input:not([type=hidden]),[role=combobox]").evaluateAll(fields => fields.map(field => parseFloat(getComputedStyle(field).fontSize)));
    expect(sizes.every(size => size >= 16)).toBe(true);
    await expect(amount).toHaveValue("1.5");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/grocery-mobile-pantry.png" });
  await dialog.getByRole("button", { name: "Ajouter à mes réserves", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Voir mes réserves", exact: true }).click();
  await expect(page.locator(".pantry-group li").filter({ hasText: "Oignon" })).toContainText("1 1/2 tasse US");
});

test("pantry dialog follows keyboard viewport and keeps fields, scrolling and cancel usable", async ({ page }) => {
  await page.goto("/fr/demo");
  await planGroceries(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // Desktop automation does not open an iOS keyboard. Reproduce its visual viewport
  // shrinking and panning while the layout viewport stays at its original size.
  await page.evaluate(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: Object.assign(new EventTarget(), { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 }) });
  });
  await page.getByRole("button", { name: "Déjà en réserve : Bœuf haché extra maigre", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const amount = dialog.getByLabel("Quantité en réserve", { exact: false });
  await expect(amount).toHaveValue("");
  await selectAppOption(dialog.getByRole("combobox", { name: "Mesure", exact: true }), "mass");
  await amount.fill("500");
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 310, offsetTop: 94 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
    window.visualViewport!.dispatchEvent(new Event("scroll"));
  });
  await assertDialogFits(page, 390, 310, 94);
  const details = dialog.getByLabel("Précisions", { exact: true });
  await details.fill("Un paquet de 500 g");
  await expect.poll(async () => {
    const field = await details.boundingBox(), box = await dialog.boundingBox();
    return field!.y + field!.height <= box!.y + box!.height - 10;
  }).toBe(true);
  await expect(amount).toHaveValue("500");
  await page.screenshot({ path: "artifacts/grocery-mobile-keyboard.png" });
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".grocery-item")).toHaveCount(2);
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await page.getByRole("button", { name: "Déjà en réserve : Bœuf haché extra maigre", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "Mesure", exact: true })).toHaveAttribute("data-value", "volume");
  await expect(dialog.getByLabel("Quantité en réserve", { exact: false })).toHaveValue("");
  await assertDialogFits(page, 390, 844);
});
