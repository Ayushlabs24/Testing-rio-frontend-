import { defineConfig, devices } from "@playwright/test";

// Dedicated config for ad-hoc UAT runs against a throwaway backend (port
// 3010) + a throwaway production build of the frontend (port 3011) — never
// the developer's own live 3000/3001 session. Both processes are started
// manually before this runs; no webServer block here on purpose.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /uat-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-uat", open: "never" }],
  ],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3011",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
