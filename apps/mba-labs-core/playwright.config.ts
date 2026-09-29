import { defineConfig, devices } from "@playwright/test";

const qaMode = process.env.MBA_COTACOES_E2E_QA === "true";
const baseURL = qaMode
  ? process.env.QA_BASE_URL
  : "http://127.0.0.1:3000";

if (qaMode && !baseURL) {
  throw new Error("QA_BASE_URL é obrigatória quando MBA_COTACOES_E2E_QA=true.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop-1366", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "chromium-desktop-1920", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "chromium-mobile-360", use: { ...devices["Galaxy S9+"], viewport: { width: 360, height: 740 } } },
    { name: "chromium-mobile-375", use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } } },
    { name: "chromium-mobile-390", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
    { name: "chromium-mobile-412", use: { ...devices["Galaxy S9+"], viewport: { width: 412, height: 915 } } },
    { name: "chromium-mobile-430", use: { ...devices["Galaxy S9+"], viewport: { width: 430, height: 932 } } },
  ],
  webServer: qaMode
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          NEXT_PUBLIC_DATA_MODE: "demo",
        },
      },
});
