import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { menuSchema } from "../src/lib/validation";
import { demoData } from "../src/lib/demo";

test("private pages and API deny unauthenticated access; production blocks demo", async ({
  request,
}) => {
  const privatePage = await request.get("/fr/dashboard", { maxRedirects: 0 });
  expect(privatePage.status()).toBe(307);
  expect(privatePage.headers().location).toBe("/fr");
  expect((await request.get("/api/vault")).status()).toBe(401);
  expect(
    (
      await request.post("/api/personal", {
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
      await request.post("/api/personal", {
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

test("native Google form preserves the browser Origin for CSRF validation", async ({
  page,
}) => {
  await page.goto("/fr");
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/google") &&
      response.request().method() === "POST",
  );
  // Submit the real form even though OAuth is intentionally unconfigured in
  // this test server. An accepted origin reaches the 503 configuration guard;
  // no-referrer used to turn the browser Origin into null and return 403.
  await page
    .locator('form[action="/auth/google"]')
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  const response = await submitted;
  expect(response.request().headers().origin).toBe("http://127.0.0.1:3000");
  expect(response.status()).toBe(503);
  await expect(page.locator("body")).toHaveText(
    "Authentication is not configured",
  );
  await page.goto("/fr");
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
  await page.getByRole("button", { name: "Écrire aujourd’hui", exact: true }).click();
  await expect(page.getByLabel("Titre de la page")).toBeVisible();
  expect(external).toEqual([]);
});
