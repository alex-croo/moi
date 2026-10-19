import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run start -- --port 3000",
      url: "http://127.0.0.1:3000/fr",
      reuseExistingServer: false,
      env: {
        ENABLE_DEMO: "true",
        SITE_URL: "http://127.0.0.1:3000",
        VERCEL: "",
      },
      timeout: 60000,
    },
    {
      command: "npm run start -- --port 3001",
      url: "http://127.0.0.1:3001/fr",
      reuseExistingServer: false,
      env: {
        ENABLE_DEMO: "true",
        SITE_URL: "https://iamable.space",
        VERCEL: "1",
      },
      timeout: 60000,
    },
  ],
});
