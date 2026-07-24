import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const DATABASE_URL = "postgresql://cnap_owner:cnap_owner_dev_pw@localhost:5433/cnap";

// UAT: classification fallback-chain exhaustion and recovery.
//
//   Gemini unavailable -> no previous Need -> no default Domain
//     -> AI Classification Failed -> Retry -> Success
//
// Runs against the throwaway backend (port 3010, started with an
// intentionally invalid GEMINI_API_KEY for this run) + throwaway frontend
// (port 3011). The backend's Domain table (global, not org-scoped) has been
// temporarily deactivated for every row so Tier 3 (default domain) also has
// nothing to fall back to — the only way to force every fallback tier to
// genuinely exhaust. Both are restored immediately after this test file
// finishes (see the operator's own cleanup, not part of this spec).

const NEW_PASSWORD = "A-Brand-New-Password1";
const REGION = "Riyadh";
const GOVERNORATE = "Ad-Diriyah";
const CENTER = "Bawdah";

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function acceptConsentIfPresent(page: Page) {
  const heading = page.getByRole("heading", { name: "Before you continue" });
  const appeared = await heading
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "I agree, continue" }).click();
  }
}

async function signupOrg(
  page: Page,
  orgName: string,
  registrationNumber: string,
  email: string,
): Promise<string> {
  await page.goto("/signup");
  await page.getByLabel("Organization name").fill(orgName);
  await page.getByLabel("Registration number").fill(registrationNumber);

  await page.getByRole("combobox", { name: "Sector" }).click();
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await page.getByLabel("Please specify").fill("Community Infrastructure");

  await page.getByRole("button", { name: "Region", exact: true }).click();
  await page.getByPlaceholder("Search regions").fill(REGION);
  await page.getByRole("button", { name: REGION, exact: true }).click();

  await page.getByText("Select governorates", { exact: true }).click();
  await page.getByPlaceholder("Search governorates").fill(GOVERNORATE);
  await page.getByRole("listbox").getByText(GOVERNORATE, { exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await page.getByText("Select centers", { exact: true }).click();
  await page.getByPlaceholder("Search centers").fill(CENTER);
  await page.getByRole("listbox").getByText(CENTER, { exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create organization" }).click();

  await expect(page.getByRole("heading", { name: "Your account is ready" })).toBeVisible({
    timeout: 15_000,
  });
  const temporaryPassword = await page.getByLabel("Temporary password").inputValue();
  await page.getByRole("button", { name: "Go to sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  return temporaryPassword;
}

async function changeTemporaryPassword(page: Page, email: string, tempPassword: string) {
  await page.goto("/");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(tempPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await page.getByLabel("Temporary password").fill(tempPassword);
  await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Update password" }).click();
  await acceptConsentIfPresent(page);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test("Gemini unavailable + no prior Need + no default Domain -> AI Classification Failed -> Retry -> Success", async ({
  page,
}) => {
  const unique = Date.now();
  const orgName = `Fallback Chain UAT ${unique}`;
  const adminEmail = `admin.${unique}@fallback-uat.org`;

  // --- Setup: org, study, first Need in this org (guarantees Tier 2 --
  // "prior classified Needs in this geography" -- has nothing to find). ---
  const tempPassword = await signupOrg(page, orgName, `NGO-2026-${unique}`, adminEmail);
  await changeTemporaryPassword(page, adminEmail, tempPassword);
  await login(page, adminEmail, NEW_PASSWORD);

  await page.goto("/studies");
  await page.getByRole("button", { name: "New study" }).click();
  await page.getByLabel("Study title").fill(`Fallback Chain Study ${unique}`);
  await page.getByText("Select governorates", { exact: true }).click();
  await page.getByPlaceholder("Search governorates").fill(GOVERNORATE);
  await page.getByRole("listbox").getByText(GOVERNORATE, { exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("Select centers", { exact: true }).click();
  await page.getByPlaceholder("Search centers").fill(CENTER);
  await page.getByRole("listbox").getByText(CENTER, { exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save study" }).click();
  await expect(page).toHaveURL(/\/studies\/(?!new$)[^/]+\/needs\/new$/, {
    timeout: 15_000,
  });

  await page
    .getByLabel("Need statement")
    .fill(
      "Residents of this village have no reliable access to clean drinking water " +
        "and depend on costly private tankers for daily needs.",
    );
  await page.getByText("Select governorates", { exact: true }).click();
  await page.getByPlaceholder("Search governorates").fill(GOVERNORATE);
  await page.getByRole("listbox").getByText(GOVERNORATE, { exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("Select centers", { exact: true }).click();
  await page.getByPlaceholder("Search centers").fill(CENTER);
  await page.getByRole("listbox").getByText(CENTER, { exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await page.getByRole("button", { name: "Save need" }).click();
  await expect(page).toHaveURL(/\/studies\/[^/]+\/needs\/(?!new$)[^/]+$/, {
    timeout: 15_000,
  });

  // --- All three fallback tiers exhausted: Gemini is broken (bad key on
  // this throwaway backend), this org has zero prior classified Needs, and
  // every Domain is deactivated (see the operator's DB snapshot/restore
  // around this run) -- the only combination that can ever legitimately
  // produce ai_classification_failed. ---
  await expect(page.getByText("Unable to Classify", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Unable to classify this need.", { exact: true }),
  ).toBeVisible();

  const retryButton = page.getByRole("button", { name: "Retry AI Classification" });
  await expect(retryButton).toBeVisible();

  // --- First Retry: still every tier unavailable -> still fails. ---
  await retryButton.click();
  await expect(page.getByText("Retrying...", { exact: true })).toBeVisible();
  await expect(page.getByText("Unable to Classify", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // --- Recovery: a Domain becomes available (Gemini remains down the
  // whole time) -- Retry now succeeds via Tier 3 (default domain). Confirms
  // the fallback chain, not a Gemini recovery, is what fixes this. ---
  execSync(
    `psql "${DATABASE_URL}" -c "UPDATE domains SET is_active=true WHERE name='Water & Sanitation';"`,
  );
  try {
    await retryButton.click();
    await expect(page.getByText("Retrying...", { exact: true })).toBeVisible();
    await expect(
      page.getByText("AI Classification Completed", { exact: true }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Water & Sanitation")).toBeVisible();
  } finally {
    // Always restore this one row even if an assertion above throws --
    // the full domain-set restore still happens separately afterward, but
    // this keeps a failed run from leaving the DB in a half-fixed state
    // for longer than necessary.
    execSync(
      `psql "${DATABASE_URL}" -c "UPDATE domains SET is_active=false WHERE name='Water & Sanitation';"`,
    );
  }
});
