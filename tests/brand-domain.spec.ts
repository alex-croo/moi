import { test, expect } from "@playwright/test";
import { sameOrigin, trustedOrigin } from "../src/lib/security";

test("the new domain and explicit legacy alias keep separate same-origin boundaries", () => {
  const saved = { SITE_URL: process.env.SITE_URL, SITE_URL_ALIASES: process.env.SITE_URL_ALIASES, VERCEL: process.env.VERCEL };
  try {
    process.env.SITE_URL = "https://tredmeal.com";
    process.env.SITE_URL_ALIASES = "https://iamable.space";
    process.env.VERCEL = "1";
    expect(trustedOrigin()).toBe("https://tredmeal.com");
    for (const host of ["tredmeal.com", "iamable.space"]) {
      const req = new Request(`https://${host}/api/personal`, { headers: { origin: `https://${host}` } });
      expect(trustedOrigin(req)).toBe(`https://${host}`);
      expect(sameOrigin(req)).toBe(true);
      expect(sameOrigin(new Request(req.url, { headers: { origin: "https://attacker.example" } }))).toBe(false);
    }
    expect(sameOrigin(new Request("https://iamable.space/api/personal", { headers: { origin: "https://tredmeal.com" } }))).toBe(false);
    expect(sameOrigin(new Request("https://attacker.example/api/personal", { headers: { origin: "https://tredmeal.com", "x-forwarded-host": "tredmeal.com" } }))).toBe(false);
    expect(trustedOrigin(new Request("https://tredmeal.com.attacker.example/auth/callback"))).toBeNull();
    expect(sameOrigin(new Request("https://tredmeal.com/api/personal"))).toBe(false);
    process.env.SITE_URL_ALIASES = "https://user:password@attacker.example,http://iamable.space,https://iamable.space/path";
    expect(trustedOrigin(new Request("https://iamable.space/auth/callback"))).toBeNull();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("public and private layouts present Tred’meal without sidebar overflow", async ({ page }) => {
  await page.goto("/fr");
  await expect(page).toHaveTitle("Tred’meal — Un jour à la fois");
  await expect(page.getByRole("img", { name: "Tred’meal — by Croo.Studio" })).toBeVisible();
  await page.goto("/fr/demo");
  const logo = page.locator(".sidebar .brand-logo");
  for (const width of [1440, 900]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(logo).toBeVisible();
    const bounds = await logo.evaluate((el: HTMLImageElement) => ({
      loaded: el.complete && el.naturalWidth > 0,
      right: el.getBoundingClientRect().right,
      sidebarRight: el.closest(".sidebar")!.getBoundingClientRect().right,
    }));
    expect(bounds.loaded).toBe(true);
    expect(bounds.right).toBeLessThan(bounds.sidebarRight);
  }
});
