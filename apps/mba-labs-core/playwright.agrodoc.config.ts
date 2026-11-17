import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  outputDir: "./test-results/agrodoc",
  timeout: 45000,
  use: {
    baseURL: process.env.AGRODOC_BASE_URL,
    storageState: process.env.AGRODOC_STORAGE_STATE,
    viewport: { width: 1448, height: 1086 },
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/agrodoc", open: "never" }],
  ],
});
