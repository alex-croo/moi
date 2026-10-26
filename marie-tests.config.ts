import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./tests",workers:2,reporter:"list"});
