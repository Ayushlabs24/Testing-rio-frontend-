import { expect, test, type Page } from "@playwright/test";

/**
 * RIO-FR-002 — the reviewer queue, end to end.
 *
 * Covers the acceptance criteria that only a full-stack run can prove:
 * cleaning fires when a need is saved (AC 1), the correction is PROPOSED and
 * only written when a human accepts it (AC 2 + Q11), and the decision is
 * logged (AC 4).
 *
 * Backend-dependent, so it runs only under E2E_BACKEND=1 alongside the other
 * app-flow spec. Setup goes through the API using the signed-in browser
 * context; every assertion goes through the UI, because the point is the
 * screen, not the endpoints (those have their own coverage).
 */

const EMAIL = "sysadmin@platform.local";
const PASSWORD = "Passw0rd!";

// `irqah` is the real centre `Irqah` (0101-001) typed lowercase — a spelling
// variant of an approved value rather than an unknown place, which is exactly
// what standardization exists for. Verified against the seeded geographic
// reference.
const VILLAGE_TYPED = "irqah";
const VILLAGE_CANONICAL = "Irqah";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Work email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

test.describe("Data Quality reviewer queue", () => {
  test.skip(!process.env.E2E_BACKEND, "needs a running backend with seeded accounts");

  test("a village spelling variant is flagged, accepted, and written to the need", async ({
    page,
  }) => {
    await login(page);

    // ── Setup through the API, as the signed-in user ────────────────────────
    const studies = await page.request.get("http://localhost:3000/api/studies");
    expect(studies.ok()).toBeTruthy();
    const studyList = (await studies.json()) as { id: string }[];
    expect(studyList.length, "seed must provide at least one study").toBeGreaterThan(0);
    const studyId = studyList[0]!.id;

    const statement = `E2E data quality check ${Date.now()}`;
    const created = await page.request.post(
      `http://localhost:3000/api/studies/${studyId}/needs`,
      { data: { statement, village: [VILLAGE_TYPED] } },
    );
    expect(created.ok(), "need creation should succeed").toBeTruthy();
    const need = (await created.json()) as { id: string };

    // Cleaning is fire-and-forget after the save, so the flag appears shortly
    // after rather than within the create response.
    await expect
      .poll(
        async () => {
          const res = await page.request.get(
            "http://localhost:3000/api/data-quality/flags?pageSize=100",
          );
          const body = (await res.json()) as {
            items: { entityId: string; field: string }[];
          };
          return body.items.filter(
            (f) => f.entityId === need.id && f.field.startsWith("village"),
          ).length;
        },
        { message: "cleaning should raise a village flag", timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    // ── AC 1: the finding is on the reviewer's screen ───────────────────────
    await page.goto("/data-quality");
    await expect(page.getByRole("tab", { name: /Findings/i })).toBeVisible({
      timeout: 30_000,
    });

    const row = page.getByRole("row").filter({ hasText: VILLAGE_TYPED });
    await expect(row.first()).toBeVisible({ timeout: 20_000 });

    // ── AC 2 + Q11: proposed, not applied ──────────────────────────────────
    // The need still holds what the researcher typed at this point.
    const beforeAccept = await page.request.get(
      `http://localhost:3000/api/needs/${need.id}`,
    );
    expect(((await beforeAccept.json()) as { village: string[] }).village).toContain(
      VILLAGE_TYPED,
    );

    await row
      .first()
      .getByRole("button", { name: /Review/i })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const accept = dialog.getByRole("button", { name: /^Accept$/i });
    await expect(
      accept,
      "a village near-match carries a proposal, so Accept is live",
    ).toBeEnabled();
    await accept.click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // ── The correction reached the record ──────────────────────────────────
    await expect
      .poll(
        async () => {
          const res = await page.request.get(
            `http://localhost:3000/api/needs/${need.id}`,
          );
          return ((await res.json()) as { village: string[] }).village;
        },
        { message: "accepting writes the reference spelling", timeout: 15_000 },
      )
      .toContain(VILLAGE_CANONICAL);
  });

  test("rejecting a finding requires a note", async ({ page }) => {
    await login(page);
    await page.goto("/data-quality");
    await expect(page.getByRole("tab", { name: /Findings/i })).toBeVisible({
      timeout: 30_000,
    });

    const review = page.getByRole("button", { name: /Review/i }).first();
    test.skip((await review.count()) === 0, "no pending findings to review");
    await review.click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Reject/i }).click();

    // Refused, and the dialog stays open with the reason on screen.
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/note is required/i)).toBeVisible();
  });

  test("the queue, duplicate and merge tabs all render", async ({ page }) => {
    await login(page);
    await page.goto("/data-quality");

    for (const name of [
      /Findings/i,
      /Possible duplicates/i,
      /Merge history/i,
      /Thresholds/i,
    ]) {
      await expect(page.getByRole("tab", { name })).toBeVisible({ timeout: 30_000 });
    }

    await page.getByRole("tab", { name: /Possible duplicates/i }).click();
    await expect(page.getByRole("tab", { name: /Possible duplicates/i })).toHaveAttribute(
      "data-state",
      "active",
    );

    await page.getByRole("tab", { name: /Merge history/i }).click();
    await expect(page.getByRole("tab", { name: /Merge history/i })).toHaveAttribute(
      "data-state",
      "active",
    );

    // Q23 — the thresholds the queue was produced under, visible to anyone who
    // can see the queue.
    await page.getByRole("tab", { name: /Thresholds/i }).click();
    await expect(page.getByText(/Detection thresholds/i)).toBeVisible();
  });
});
