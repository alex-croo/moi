import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["privacy.spec.ts", "database.spec.ts", "units.spec.ts"],
  workers: 2,
  reporter: "list",
});
