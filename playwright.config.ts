import { defineConfig, devices } from "@playwright/test";

// Cross-browser rendering coverage for RIO-NFR-009 ("works on modern browsers;
// no major rendering errors"). The render specs (home + browser-compat) are
// backend-independent — they exercise the public, client-rendered pages, so the
// same suite runs identically on every engine without a running API.
const RENDER_SPECS = /(home|browser-compat)\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    // Modern desktop engines: Chromium (Chrome/Edge), Gecko (Firefox), WebKit (Safari).
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testMatch: RENDER_SPECS },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testMatch: RENDER_SPECS },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testMatch: RENDER_SPECS },
    // Mobile viewports (same engines, small screens): Chrome on Android, Safari on iOS.
    { name: "Mobile Chrome", use: { ...devices["Pixel 7"] }, testMatch: RENDER_SPECS },
    { name: "Mobile Safari", use: { ...devices["iPhone 14"] }, testMatch: RENDER_SPECS },
    // Full app-flow tests (login → dashboard, RBAC nav) need a running backend
    // with seeded accounts; opt in with E2E_BACKEND=1 so the default cross-browser
    // run stays backend-independent and green. (auth-flows.spec.ts is also being
    // realigned to the real backend contract separately.)
    ...(process.env.E2E_BACKEND
      ? [
          {
            name: "chromium-app-flows",
            use: { ...devices["Desktop Chrome"] },
            // RIO-FR-002's reviewer queue joins the same opt-in project: it
            // needs the real backend, the seeded accounts and the geographic
            // reference to prove cleaning fires and a correction is written.
            testMatch: /(auth-flows|data-quality)\.spec\.ts/,
          },
        ]
      : []),
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
