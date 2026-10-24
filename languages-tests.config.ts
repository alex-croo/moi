import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:['languages.spec.ts','guided-learning.spec.ts','receipt.spec.ts','units.spec.ts'],grepInvert:/pasted receipt is reviewed|receipt photo works alone/,workers:1,reporter:'line',timeout:120000});
