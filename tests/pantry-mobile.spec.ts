import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });

async function openPantry(page: Page) {
  await page.goto("/fr/demo");
  await page.getByRole("navigation").getByRole("button", { name: "Mes réserves", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Ajouter un aliment", exact: true }).click();
}

async function fits(page: Page, width: number, height: number, top = 0) {
  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(11);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width - 11);
  expect(box!.y).toBeGreaterThanOrEqual(top + 11);
  expect(box!.y + box!.height).toBeLessThanOrEqual(top + height - 11);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await dialog.locator("input,select").evaluateAll(fields => fields.every(field => parseFloat(getComputedStyle(field).fontSize) >= 16))).toBe(true);
}

test("mobile pantry add and edit preserve units and quantities across narrow screens and rotation", async ({ page }) => {
  await openPantry(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Fermer", exact: true })).toBeFocused();
  await dialog.getByLabel("Aliment", { exact: true }).selectOption("custom");
  await dialog.getByLabel("Nom de l’aliment", { exact: true }).fill("Bouillon maison");
  await dialog.getByLabel("Mesure", { exact: true }).selectOption("volume");
  const amount = dialog.getByLabel(/Quantité \(facultatif\)/);
  await expect(amount).toHaveAttribute("inputmode", "decimal");
  await amount.fill("250.5");
  await dialog.getByLabel("Cet aliment est congelé", { exact: true }).check();
  await dialog.getByLabel("Petit repère (facultatif)", { exact: true }).fill("Deux petits contenants");
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => dialog.evaluate(el => el.style.getPropertyValue("--dialog-width"))).toBe(`${width}px`);
    await fits(page, width, height);
    await expect(amount).toHaveValue("250.5");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/pantry-mobile-add.png" });
  await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.locator(".pantry-group li").filter({ hasText: "Bouillon maison" });
  await expect(row).toHaveCount(1);
  await page.getByRole("button", { name: "Modifier Bouillon maison", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Modifier un aliment");
  await expect(dialog.getByLabel("Mesure", { exact: true })).toHaveValue("volume");
  await expect(amount).toHaveValue("250.5");
  await expect(dialog.getByLabel("Où le ranger", { exact: true })).toHaveValue("freezer");
  await expect(dialog.getByLabel("Petit repère (facultatif)", { exact: true })).toHaveValue("Deux petits contenants");
  // Validation belongs inside the modal; it must preserve the user's draft.
  await amount.fill("1000001");
  await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(amount).toHaveValue("1000001");
  await amount.fill("125.25");
  await dialog.getByLabel("Où le ranger", { exact: true }).selectOption("fridge");
  await fits(page, 390, 844);
  await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toHaveCount(1);
  await page.getByRole("button", { name: "Modifier Bouillon maison", exact: true }).click();
  await expect(amount).toHaveValue("125.25");
  await expect(dialog.getByLabel("Où le ranger", { exact: true })).toHaveValue("fridge");
  await page.screenshot({ path: "artifacts/pantry-mobile-edit.png" });
  await amount.fill("50");
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.getByRole("button", { name: "Modifier Bouillon maison", exact: true }).click();
  await expect(amount).toHaveValue("125.25");
});

test("mobile pantry fields and actions remain reachable with a keyboard during add and edit", async ({ page }) => {
  await openPantry(page);
  const dialog = page.getByRole("dialog");
  // Reopen after supplying a visual viewport that can emulate an on-screen keyboard.
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.evaluate(() => Object.defineProperty(window, "visualViewport", { configurable: true, value: Object.assign(new EventTarget(), { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 }) }));
  for (const editing of [false, true]) {
    await page.getByRole("button", { name: editing ? "Modifier Bœuf haché extra maigre" : "Ajouter un aliment", exact: true }).click();
    await dialog.getByLabel("Aliment", { exact: true }).selectOption("beef-95-raw");
    const amount = dialog.getByLabel(/Quantité \(facultatif\)/);
    if (editing) await expect(amount).toHaveValue("500");
    await amount.fill(editing ? "250" : "500");
    await page.evaluate(() => {
      Object.assign(window.visualViewport!, { height: 310, offsetTop: 80 });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await fits(page, 390, 310, 80);
    const note = dialog.getByLabel("Petit repère (facultatif)", { exact: true });
    await note.fill("Un paquet");
    await expect.poll(async () => {
      const box = await dialog.boundingBox(), field = await note.boundingBox();
      return field!.y + field!.height <= box!.y + box!.height - 10;
    }).toBe(true);
    await page.screenshot({ path: `artifacts/pantry-mobile-keyboard-${editing ? "edit" : "add"}.png` });
    await dialog.getByRole("button", { name: "Garder dans mes réserves", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.evaluate(() => {
      Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
  }
  await expect(page.locator(".pantry-group li")).toHaveCount(1);
  await expect(page.locator(".pantry-group li")).toContainText("250 g");
});
