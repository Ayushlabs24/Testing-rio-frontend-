import { expect, test } from "@playwright/test";

/**
 * RIO-NFR-009 — cross-browser rendering smoke.
 *
 * Runs on every configured engine (Chromium, Firefox, WebKit, and the two
 * mobile viewports — see playwright.config.ts). For each public, client-rendered
 * page it asserts the acceptance criterion "no major rendering errors":
 *   1. the page's <h1> heading renders and is visible (the shell mounted),
 *   2. at least one form control renders (the page's interactive content mounted),
 *   3. no uncaught JavaScript error was thrown while loading.
 *
 * These pages are pre-auth and do not require the backend. Network calls the
 * shell may make (e.g. a session probe) can fail without a running API — that is
 * a caught fetch error, not a rendering error, so console/network noise is not
 * asserted here; an *uncaught* exception (which would break rendering) is.
 */
const PUBLIC_ROUTES = [
  { path: "/", name: "login" },
  { path: "/otp", name: "otp" },
  { path: "/forgot-password", name: "forgot-password" },
  { path: "/reset-password", name: "reset-password" },
  { path: "/signup", name: "signup" },
];

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} page renders without errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const response = await page.goto(route.path, { waitUntil: "load" });
    // The route resolved to a real page (not a 4xx/5xx shell).
    expect(response, `no response for ${route.path}`).not.toBeNull();
    expect(response!.status(), `bad status for ${route.path}`).toBeLessThan(400);

    // 1. The page heading mounted and is visible.
    const heading = page.locator("h1").first();
    await expect(heading, `no visible <h1> on ${route.path}`).toBeVisible();
    await expect(heading).not.toHaveText("");

    // 2. Interactive content mounted (every public auth page has an input).
    await expect(
      page.locator("input").first(),
      `no visible input on ${route.path}`,
    ).toBeVisible();

    // 3. Nothing threw during load/hydration.
    expect(
      pageErrors,
      `uncaught errors on ${route.path}: ${pageErrors.join("; ")}`,
    ).toEqual([]);
  });
}
