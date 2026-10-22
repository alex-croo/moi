import { test, expect } from "@playwright/test";

for (const locale of ["fr", "en"] as const) {
  test(`recipes, menus and documents stay usable without PDF exports (${locale})`, async ({ page }) => {
    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    const t = (fr: string, en: string) => locale === "fr" ? fr : en;
    await page.goto(`/${locale}/demo`);
    const nav = page.getByRole("navigation");
    const noPdf = () => expect(page.getByRole("button", { name: /PDF|export/i })).toHaveCount(0);
    await noPdf();
    await nav.getByRole("button", { name: t("Mes recettes", "My recipes"), exact: true }).click();
    await expect(page.locator(".recipe-open")).toHaveCount(1);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await noPdf();
    await page.locator(".recipe-open").click();
    await expect(page.locator(".ingredient-list")).toBeVisible();
    await noPdf();
    await page.getByRole("button", { name: t("Fermer la recette", "Close recipe") }).click();
    await nav.getByRole("button", { name: t("Mes menus", "My menus"), exact: true }).click();
    await expect(page.locator(".week-day")).toHaveCount(7);
    await noPdf();
    await nav.getByRole("button", { name: t("Mes documents", "My documents"), exact: true }).click();
    await expect(page.locator(".document-card")).toHaveCount(0);
    await noPdf();
    await expect(page.getByRole("button", { name: t("Ajouter un lien Drive", "Add a Drive link"), exact: true })).toBeVisible();
    expect(downloads).toEqual([]);
  });
}
