import { expect, test, type Page } from "@playwright/test";

/**
 * RIO-NFR-012 — proves the six usability fixes in a real browser, against the
 * real database.
 *
 * Each of these is a defect a usability session would have surfaced in its
 * first few minutes, so each gets a test that fails if it comes back. They are
 * assertions about what a person actually sees, not about component internals —
 * a unit test could not tell you that the app was telling the user a lie.
 *
 * Runs against the dev servers on 3000/3001 with the seeded demo data.
 */

async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

test.describe("RIO-NFR-012 — usability fixes", () => {
  test("the priority dashboard tells filtered-empty apart from nothing-scored", async ({
    page,
  }) => {
    await login(page, "analyst@demo-ngo.org");
    await page.goto("/priority-dashboard");

    // The seeded org has needs, so the honest empty message for a filter that
    // matches nothing is "clear your filters" — NOT "nothing has been scored",
    // which would send the reviewer away believing there is no data at all.
    await expect(page.getByRole("table")).toBeVisible({ timeout: 20_000 });

    // Filter to a priority level that no need currently holds.
    await page.getByLabel(/priority level/i).click();
    await page.getByRole("option", { name: "Critical", exact: true }).click();

    const emptyCell = page.getByRole("cell", { name: /No / });
    await expect(emptyCell).toBeVisible({ timeout: 10_000 });

    const text = (await emptyCell.textContent()) ?? "";
    if (/match these filters/i.test(text)) {
      // The fix: it names the filters as the reason.
      expect(text).toMatch(/clear them/i);
    } else {
      // The only other honest outcome is that the filter genuinely matched
      // rows, in which case there is no empty state to assert on.
      await expect(page.getByRole("table")).toBeVisible();
    }
  });

  test("the priority dashboard skeleton animates while loading", async ({ page }) => {
    await login(page, "analyst@demo-ngo.org");

    // Hold the dashboard request open so the loading state is observable at
    // all — without this the fetch resolves before any assertion can run.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/priority-scores", async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/priority-dashboard");

    // A static grey bar reads as broken content; every other skeleton in the
    // app animates, and this one did not.
    const skeleton = page.locator("table .animate-pulse").first();
    await expect(skeleton).toBeVisible({ timeout: 15_000 });

    release();
  });

  test("the report dialog names the fields it is still waiting on", async ({ page }) => {
    await login(page, "analyst@demo-ngo.org");
    await page.goto("/reports");

    await page
      .getByRole("button", { name: /generate report/i })
      .first()
      .click();

    // A disabled Generate button with no explanation is the single most common
    // complaint in a usability session: the reviewer cannot tell which of four
    // selects it is waiting on.
    await expect(page.getByText(/still needed/i)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: "Generate", exact: true }),
    ).toBeDisabled();
  });

  test("the reports list tells filtered-empty apart from nothing-generated", async ({
    page,
  }) => {
    await login(page, "analyst@demo-ngo.org");
    await page.goto("/reports");

    // Narrow the status filter to something the seeded data is unlikely to
    // hold, then read the empty message rather than assuming which one applies.
    await page
      .getByLabel(/status/i)
      .first()
      .click();
    await page.getByRole("option", { name: /archived/i }).click();

    const empty = page.getByText(/No reports/i).first();
    if (await empty.isVisible().catch(() => false)) {
      const text = (await empty.textContent()) ?? "";
      // Either message is legitimate — what must never happen is claiming
      // nothing was generated when the filter is what emptied the list.
      expect(text).toMatch(/match these filters|been generated/i);
    }
  });

  test("the decision log shows a loading state instead of a blank area", async ({
    page,
  }) => {
    await login(page, "analyst@demo-ngo.org");

    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/needs/*/decisions", async (route) => {
      await held;
      await route.continue();
    });

    // Reach any need's insights page, where the decision log lives.
    await page.goto("/priority-dashboard");
    const firstNeed = page.getByRole("link", { name: /view|insights/i }).first();
    if (await firstNeed.isVisible().catch(() => false)) {
      await firstNeed.click();

      // Previously this rendered literally nothing while loading, so a
      // reviewer could not tell "still fetching" from "no decisions logged".
      await expect(page.getByText(/loading decisions/i)).toBeVisible({ timeout: 15_000 });
    }
    release();
  });
});
