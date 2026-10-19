import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { menuSchema } from "../src/lib/validation";
import { demoData } from "../src/lib/demo";

test("private pages and API deny unauthenticated access; production blocks demo", async ({
  request,
}) => {
  const privatePage = await request.get("/fr/dashboard", { maxRedirects: 0 });
  expect(privatePage.status()).toBe(307);
  expect(privatePage.headers().location).toBe("/fr");
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect(
    (
      await request.post("/api/workspace", {
        headers: { Origin: "http://127.0.0.1:3000" },
        data: {
          type: "weight",
          data: { value: 180, unit: "lb", date: "2026-10-18" },
        },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/workspace", {
        headers: { Origin: "https://attacker.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/auth/google", {
        headers: { Origin: "https://attacker.example" },
        form: { locale: "en" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/auth/logout", {
        headers: { Origin: "https://attacker.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("http://127.0.0.1:3001/fr/demo")).status()).toBe(
    404,
  );
  const response = await request.get("/fr");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers()["content-security-policy"]).toContain(
    "script-src 'self' 'nonce-",
  );
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});

test("login is bilingual and does not pretend unconfigured Google auth works", async ({
  page,
}) => {
  await page.goto("/fr");
  await expect(
    page.getByRole("heading", { name: "Bienvenue chez vous." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuer avec Google" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your space." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("native Google form preserves the browser Origin for CSRF validation", async ({ page }) => {
  await page.goto("/fr");
  const submitted = page.waitForResponse(
    (response) => response.url().endsWith("/auth/google") && response.request().method() === "POST",
  );
  // Submit the real form even though OAuth is intentionally unconfigured in
  // this test server. An accepted origin reaches the 503 configuration guard;
  // no-referrer used to turn the browser Origin into null and return 403.
  await page.locator('form[action="/auth/google"]').evaluate(
    (form: HTMLFormElement) => form.requestSubmit(),
  );
  const response = await submitted;
  expect(response.request().headers().origin).toBe("http://127.0.0.1:3000");
  expect(response.status()).toBe(503);
  await expect(page.locator("body")).toHaveText("Authentication is not configured");
  await page.goto("/fr");
});

test("menu selection preserves empty meals and exports a real three-page Letter PDF", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/fr/demo");
  await page.getByRole("button", { name: /ven.*30/ }).click();
  await expect(
    page.getByRole("heading", { name: "À votre choix" }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: /lun.*26/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bol de poulet façon fajitas" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en PDF" }).click();
  const file = await download;
  const path = await file.path();
  const pdf = await PDFDocument.load(await readFile(path!));
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  await mkdir("artifacts", { recursive: true });
  await copyFile(path!, "artifacts/menu-exemple-fr.pdf");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chicken fajita bowl" }),
  ).toBeVisible();
  expect(page.url()).toContain("/en/demo");
  const englishDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  expect((await englishDownload).suggestedFilename()).toBe(
    "iamable-menu-2026-10-26-en.pdf",
  );
  expect(errors).toEqual([]);
});

test("weight and journal inputs update the demo and never write browser storage", async ({
  page,
}) => {
  await page.goto("/fr/demo");
  await page.getByRole("button", { name: "Noter mon poids" }).click();
  await page.getByLabel("Poids", { exact: true }).fill("189.4");
  await page.getByRole("button", { name: "Enregistrer la mesure" }).click();
  await expect(page.getByRole("status")).toContainText(
    "cette visite seulement",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon parcours" })
    .click();
  await expect(page.locator(".history")).toContainText("189,4 lb");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon journal" })
    .click();
  await page.getByRole("button", { name: "Écrire aujourd’hui" }).click();
  await page
    .getByLabel("Mes quelques lignes")
    .fill("Une belle marche et un bon repas. <script>alert(1)</script>");
  await page.getByRole("button", { name: "Humeur 4/5" }).click();
  await page.getByRole("button", { name: "Enregistrer mon entrée" }).click();
  await expect(page.locator(".journal-entry")).toContainText(
    "<script>alert(1)</script>",
  );
  await page.getByRole("button", { name: "Relire et modifier" }).click();
  await expect(page.getByLabel("Mes quelques lignes")).toHaveValue(
    "Une belle marche et un bon repas. <script>alert(1)</script>",
  );
  await page.getByLabel("Mes quelques lignes").fill("Une belle marche.");
  await page.getByRole("button", { name: "Enregistrer mon entrée" }).click();
  await expect(page.locator(".journal-entry")).toHaveCount(1);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon journal" })
    .click();
  await expect(page.locator(".journal-entry")).toHaveCount(0);
});

test("Drive links preserve private permissions and reject lookalike domains", async ({
  page,
}) => {
  await page.goto("/fr/demo");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mes documents" })
    .click();
  await page.getByRole("button", { name: "Ajouter un lien Drive" }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Mon document de test");
  await page
    .getByLabel("Lien Google Drive ou Google Docs")
    .fill("https://docs.google.com.evil.example/document/test");
  await page.getByRole("button", { name: "Ajouter le document" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Google Drive ou Google Docs",
  );
  await page
    .getByLabel("Lien Google Drive ou Google Docs")
    .fill("https://docs.google.com/document/d/example");
  await page.getByRole("button", { name: "Ajouter le document" }).click();
  const link = page.getByRole("link", { name: /Mon document de test/ });
  await expect(link).toHaveAttribute(
    "href",
    "https://docs.google.com/document/d/example",
  );
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("imports validated menus, refuses malformed and non-consecutive dates", async ({
  page,
}) => {
  const menu = {
    ...demoData.plans[0],
    title: "Menu importé",
    titleEn: "Imported menu",
  };
  expect(
    menuSchema.safeParse({
      ...menu,
      days: menu.days.map((d, i) => ({
        ...d,
        date: i === 1 ? "2026-11-03" : d.date,
      })),
    }).success,
  ).toBe(false);
  await page.goto("/fr/demo");
  await page.getByRole("button", { name: "Voir mon menu" }).click();
  await page.getByRole("button", { name: "Importer un menu" }).click();
  await page
    .getByLabel("Fichier de menu (.json)")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await page.getByRole("button", { name: "Ajouter à mes menus" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "six jours consécutifs",
  );
  await page
    .getByLabel("Fichier de menu (.json)")
    .setInputFiles({
      name: "menu.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(menu)),
    });
  await page.getByRole("button", { name: "Ajouter à mes menus" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mes documents" })
    .click();
  await expect(
    page.getByRole("button", { name: /Menu importé/ }),
  ).toBeVisible();
});

test("desktop and mobile layouts render without overflow or external calls", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:3000") &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      external.push(new URL(r.url()).hostname);
  });
  await mkdir("artifacts", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1120 });
  await page.goto("/fr/demo");
  await expect(
    page.getByRole("heading", { name: "Un jour à la fois." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/maquette-desktop.png",
    fullPage: true,
  });
  await page.goto("/fr");
  await page.screenshot({ path: "artifacts/connexion.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fr/demo");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/maquette-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mon journal" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mon journal de bord." }),
  ).toBeVisible();
  expect(external).toEqual([]);
});
