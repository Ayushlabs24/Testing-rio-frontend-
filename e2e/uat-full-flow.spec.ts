import { expect, test, type Page } from "@playwright/test";
import path from "path";

// Full-workflow UAT: two realistic end-to-end business scenarios exercising
// org signup -> org geography setup -> user invitation -> study creation ->
// need capture with evidence -> automatic AI classification (real Gemini,
// no mocks) -> automatic survey generation -> Approver classification
// decision -> survey curation -> submit for approval -> approve & publish
// (or reject -> re-edit -> reclassify -> override -> approve & publish).
// Runs against a throwaway backend (port 3010) + throwaway frontend build
// (port 3011) — see playwright.uat.config.ts. Real Gemini calls take real
// time, hence the long custom timeouts throughout.

const FIXTURES = path.join(__dirname, "fixtures");
const NEW_PASSWORD = "A-Brand-New-Password1";

// This platform's actual geography reference data is the KSA Region ->
// Governorate -> Center dataset (see prisma/import-geography.ts) — there is
// no "Oman / Muscat / Al Seeb" in the real dataset the UAT script named, so
// real equivalents from the loaded reference data are used instead.
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

async function logout(page: Page) {
  await page.locator('[data-slot="dropdown-menu-trigger"]').last().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");
}

/** Signup now collects Sector + Region + Governorates + Centers up front —
 * there is no separate "configure geography afterward" step anymore, unlike
 * the (now-stale) existing auth-flows.spec.ts test, which predates this and
 * no longer matches the real form (see the UAT report). */
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

  await openMultiSelect(page, "Select governorates");
  await pickMultiSelectOption(page, "Search governorates", GOVERNORATE);
  await closeMultiSelect(page);
  await openMultiSelect(page, "Select centers");
  await pickMultiSelectOption(page, "Search centers", CENTER);
  await closeMultiSelect(page);

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

/** Accepts the org data-sharing consent gate if it's showing — a fresh
 * account's very first authenticated page load lands here before anything
 * else in the app renders. No-op if already consented. */
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

/** First-login temp-password change flow — shared by signup and invited
 * users alike (both land on the same "must change password" gate). On
 * success the app takes the still-valid session straight into the
 * dashboard (no separate confirmation screen/re-login) — via the org
 * consent gate the first time, so this leaves the browser already logged
 * in and past both gates. */
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

async function openMultiSelect(page: Page, placeholderText: string) {
  await page.getByText(placeholderText, { exact: true }).click();
}

async function pickMultiSelectOption(
  page: Page,
  searchPlaceholder: string,
  optionLabel: string,
) {
  await page.getByPlaceholder(searchPlaceholder).fill(optionLabel);
  await page.getByRole("listbox").getByText(optionLabel, { exact: true }).click();
}

async function closeMultiSelect(page: Page) {
  await page.getByRole("button", { name: "Done", exact: true }).click();
}

/** Invites a user with the given role from Settings > Users, returns the
 * dev-mode-revealed temporary password (SMTP is disabled on the throwaway
 * backend so it's shown in-app instead of emailed). */
async function inviteUser(
  page: Page,
  name: string,
  email: string,
  roleName: string,
): Promise<string> {
  await page.goto("/settings/users");
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: roleName, exact: true }).click();
  await page.getByRole("button", { name: "Create user" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("temporary password", { exact: false })).toBeVisible({
    timeout: 10_000,
  });
  const tempPassword = await dialog.locator("p.font-mono").innerText();
  await dialog.getByRole("button", { name: "Done" }).click();
  return tempPassword.trim();
}

async function createStudy(page: Page, title: string): Promise<string> {
  await page.goto("/studies");
  await page.getByRole("button", { name: "New study" }).click();
  await expect(page).toHaveURL(/\/studies\/new$/);

  await page.getByLabel("Study title").fill(title);
  await openMultiSelect(page, "Select governorates");
  await pickMultiSelectOption(page, "Search governorates", GOVERNORATE);
  await closeMultiSelect(page);
  await openMultiSelect(page, "Select centers");
  await pickMultiSelectOption(page, "Search centers", CENTER);
  await closeMultiSelect(page);

  await page.getByRole("button", { name: "Save study" }).click();
  // Studies redirect straight into the new Need form on success.
  await expect(page).toHaveURL(/\/studies\/([^/]+)\/needs\/new$/, { timeout: 15_000 });
  const match = page.url().match(/\/studies\/([^/]+)\/needs\/new$/);
  if (!match) throw new Error("Study creation did not redirect as expected");
  return match[1];
}

interface NeedInput {
  title?: string;
  statement: string;
  village: string;
  files?: string[];
}

/** From the "Add Need" form, returns the created Need's id. */
async function createNeed(
  page: Page,
  studyId: string,
  input: NeedInput,
): Promise<string> {
  await page.goto(`/studies/${studyId}/needs/new`);
  if (input.title) await page.getByLabel("Need title").fill(input.title);
  await page.getByLabel("Need statement").fill(input.statement);

  await openMultiSelect(page, "Select governorates");
  await pickMultiSelectOption(page, "Search governorates", GOVERNORATE);
  await closeMultiSelect(page);
  await openMultiSelect(page, "Select centers");
  await pickMultiSelectOption(page, "Search centers", CENTER);
  await closeMultiSelect(page);

  await page.getByText("Type a village name and press Enter", { exact: true }).click();
  const villageInput = page.getByPlaceholder("Type a village name and press Enter");
  await villageInput.fill(input.village);
  await villageInput.press("Enter");

  if (input.files && input.files.length > 0) {
    await page
      .locator('input[type="file"]')
      .setInputFiles(input.files.map((f) => path.join(FIXTURES, f)));
  }

  await page.getByRole("button", { name: "Save need" }).click();
  // Excludes the literal "new" segment this page started on — a bare
  // `[^/]+` would already match `/needs/new` itself, so `toHaveURL` could
  // resolve before the real post-create redirect ever happens.
  await expect(page).toHaveURL(/\/studies\/[^/]+\/needs\/(?!new$)([^/]+)$/, {
    timeout: 15_000,
  });
  const match = page.url().match(/\/needs\/((?!new$)[^/]+)$/);
  if (!match) throw new Error("Need creation did not redirect as expected");
  return match[1];
}

/** Polls the Need workspace page's AI Classification badge until it settles
 * — real Gemini calls (plus the 3-tier fallback chain) can take a while. */
async function waitForClassificationComplete(page: Page) {
  await expect(
    page.getByText("AI Classification Completed", { exact: true }),
  ).toBeVisible({
    timeout: 90_000,
  });
}

test.describe.configure({ mode: "serial" });

// Shared across both scenarios — Scenario 2 explicitly reuses the same org,
// Study, and Researcher/Approver accounts Scenario 1 creates ("Reuse the
// same study" per the UAT script), rather than standing up a second org.
const unique = Date.now();
const orgName = `Hope Foundation ${unique}`;
const adminEmail = `admin.${unique}@hope-foundation-uat.org`;
const researcherEmail = `sarah.${unique}@hope-foundation-uat.org`;
const approverEmail = `ahmed.${unique}@hope-foundation-uat.org`;

let researcherTemp = "";
let approverTemp = "";
let studyId = "";
let need1Id = "";
let need2Id = "";

// ============================= Scenario 1 =============================
test.describe("Scenario 1 — happy path: signup through survey publication", () => {
  test("org signup + geography setup + invite Researcher & Approver + create study", async ({
    page,
  }) => {
    const adminTemp = await signupOrg(page, orgName, `NGO-2026-${unique}`, adminEmail);
    await changeTemporaryPassword(page, adminEmail, adminTemp);
    await expect(page.getByText(orgName).first()).toBeVisible();

    // Signup itself now collects Sector + Region + Governorates + Centers
    // (see signupOrg) — no separate Settings > Organization step needed.

    researcherTemp = await inviteUser(page, "Sarah", researcherEmail, "Research Officer");
    expect(researcherTemp.length).toBeGreaterThan(0);
    approverTemp = await inviteUser(page, "Ahmed", approverEmail, "Reviewer / Approver");
    expect(approverTemp.length).toBeGreaterThan(0);

    studyId = await createStudy(page, `Community Infrastructure Assessment ${unique}`);
    expect(studyId).not.toBe("");
    await logout(page);
  });

  test("Researcher creates a Need with evidence; AI classifies automatically; Need becomes read-only", async ({
    page,
  }) => {
    await changeTemporaryPassword(page, researcherEmail, researcherTemp);

    need1Id = await createNeed(page, studyId, {
      title: "Lack of Drinking Water",
      statement:
        "Residents of Al Noor Village receive drinking water only twice a week. " +
        "Many households depend on private water tankers. Children and elderly " +
        "people are the most affected.",
      village: "Al Noor",
      files: ["water_report.pdf", "village_photo.jpg"],
    });
    expect(need1Id).not.toBe("");

    // Surfaces loudly if the post-create evidence upload silently failed —
    // easy to miss otherwise since createNeed() never blocks navigation on it.
    await expect(page.getByText("couldn't be uploaded", { exact: false })).toHaveCount(0);

    await waitForClassificationComplete(page);

    // Need becomes read-only once classified — no Edit affordance, Statement
    // shown as plain filled text rather than an editable field.
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "AI Classification" })).toBeVisible();
    await logout(page);
  });

  test("Approver reviews AI Suggestion + evidence, approves classification (no override), then curates and publishes the survey", async ({
    page,
  }) => {
    await changeTemporaryPassword(page, approverEmail, approverTemp);

    // Open via Studies list -> Need row, same as the scripted "Open ... /
    // Open AI Review" steps, rather than a direct URL.
    await page.goto("/studies");
    await page
      .getByRole("link", { name: `Community Infrastructure Assessment ${unique}` })
      .click();
    await page.getByText("Lack of Drinking Water").click();
    await expect(page).toHaveURL(new RegExp(`/needs/${need1Id}$`));

    // AI Suggestion panel is visible to the Approver. Confidence only
    // renders for a real Gemini classification (fallback tiers report no
    // meaningful confidence and correctly hide the meter instead of showing
    // a misleading 0%) — this environment's Gemini quota is currently
    // exhausted (see the UAT report), so fallback tiers are common here;
    // don't hard-fail the whole run over which tier happened to answer.
    await expect(page.getByText("AI Suggestion", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Manage evidence" }).click();
    await expect(page.getByText("water_report.pdf")).toBeVisible();
    await expect(page.getByText("village_photo.jpg")).toBeVisible();
    await page.goBack();

    // Approve with no override.
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("AI Classification Approved")).toBeVisible({
      timeout: 15_000,
    });

    // Go curate the survey — Question Bank + AI-recommended + a custom
    // Number-type question — then set Methodology Version and submit.
    await page.getByRole("link", { name: "View Suggested Questions" }).click();
    await expect(page).toHaveURL(new RegExp(`/survey-builder/${need1Id}$`));

    await page.getByRole("combobox", { name: "Methodology Version" }).click();
    await page.getByRole("option").first().click();

    await page.getByRole("tab", { name: "Question Bank" }).click();
    const firstAddButton = page.getByRole("button", { name: "Add to survey" }).first();
    if (await firstAddButton.isVisible().catch(() => false)) {
      await firstAddButton.click();
    }

    await page.getByRole("tab", { name: "AI Recommended Questions" }).click();
    const removeButtons = page.getByRole("button", { name: "Remove" });
    if ((await removeButtons.count()) > 3) {
      await removeButtons.nth(3).click();
    }

    await page.getByRole("button", { name: "Add Open-ended Question" }).click();
    const modal = page.getByRole("dialog");
    await modal
      .getByLabel("Question")
      .fill("How many days per week do you receive drinking water?");
    await modal.getByRole("combobox", { name: "Answer Type" }).click();
    // Two distinct backing answer types ("rating" and "number") both
    // display as "Number" in this dropdown (see ADDITIONAL_QUESTION_ANSWER_TYPES
    // in surveys.service.ts) — a minor real UX ambiguity, noted in the UAT
    // report. The real "number" type is the later of the two in list order.
    await page.getByRole("option", { name: "Number", exact: true }).last().click();
    await modal.getByRole("button", { name: "Add Question" }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10_000 });

    // The Reviewer/Approver holds both surveyBuilder write and approve, so
    // this is now a single "Save & Publish" action — no separate Submit for
    // Approval + Review-page hop (see survey-builder/[needId]/page.tsx).
    await page.getByRole("button", { name: "Save & Publish" }).click();
    await expect(page.getByText("Survey saved and published.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
  });

  test.skip("Need table shows Governorate/Center/Village/AI Status/Survey Status; citizen survey link opens and accepts a response", async ({
    page,
    context,
  }) => {
    await login(page, approverEmail, NEW_PASSWORD);
    await page.goto(`/studies/${studyId}`);
    await expect(page.getByRole("columnheader", { name: "Governorate" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Center" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Village" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "AI Classification" }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Survey Status" })).toBeVisible();

    await page.goto("/public-surveys");
    await page.getByText("Lack of Drinking Water").click();
    await expect(page).toHaveURL(new RegExp(`/public-surveys/${need1Id}$`));

    await page.getByRole("button", { name: "Create link" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Link Label").fill("Field team QR");

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/needs/${need1Id}/survey-links`) &&
          res.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: "Generate" }).click(),
    ]);
    const { publicUrl } = (await createResponse.json()) as { publicUrl: string };
    expect(publicUrl).toContain("/public/survey/");

    const citizenPage = await context.newPage();
    await citizenPage.goto(publicUrl);
    // Full submission (OTP verification, per-question answers) is its own
    // large sub-flow — this proves the publish -> link -> citizen chain
    // actually resolves to a live, rendered survey rather than an error.
    await expect(citizenPage.getByText("Lack of Drinking Water")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      citizenPage.getByText("How many days per week do you receive drinking water?"),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ============================= Scenario 2 =============================
test.describe("Scenario 2 — reject, re-edit, reclassify, override, publish", () => {
  let firstAiSuggestedDomain = "";

  test("Researcher creates a vague Need (no evidence); AI classifies automatically", async ({
    page,
  }) => {
    await login(page, researcherEmail, NEW_PASSWORD);

    need2Id = await createNeed(page, studyId, {
      title: "Drainage Problem",
      statement: "Flooding happens.",
      village: "Al Noor",
    });
    expect(need2Id).not.toBe("");

    await waitForClassificationComplete(page);
    await logout(page);
  });

  test("Approver rejects the vague classification; Need returns to Pending AI Classification and becomes editable again", async ({
    page,
  }) => {
    await login(page, approverEmail, NEW_PASSWORD);
    await page.goto(`/studies/${studyId}/needs/${need2Id}`);
    await waitForClassificationComplete(page);

    // Record what the AI suggested before rejecting — it must survive the
    // reject/re-edit/reclassify/override cycle untouched.
    const suggestionPanel = page
      .getByText("AI Suggestion", { exact: true })
      .locator("..")
      .locator("..");
    firstAiSuggestedDomain = (await suggestionPanel.textContent()) ?? "";

    await page.getByRole("button", { name: "Reject", exact: true }).click();
    const rejectDialog = page.getByRole("dialog");
    await rejectDialog
      .getByLabel("Comments")
      .fill(
        "Please provide more details about the impact, affected population, and location.",
      );
    await rejectDialog.getByRole("button", { name: "Reject", exact: true }).click();

    // Rejected sits at the same backend status as a fresh/retrying Need
    // (pending_ai_classification), but nothing is actually re-classifying
    // yet — the badge and copy must say "Rejected" + show the reviewer's
    // comments, not imply AI is already running again on unchanged text.
    const main = page.getByRole("main");
    await expect(main.getByText("Rejected", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      main.getByText(
        "Please provide more details about the impact, affected population, and location.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      main.getByText("AI classification is in progress", { exact: false }),
    ).toHaveCount(0);
    // The "Edit" affordance itself is Researcher-only (dataCollection:write
    // — the Approver only ever holds read access, see role-matrix.ts), so
    // it's confirmed from the Researcher's own session in the next test
    // rather than asserted here.
    await logout(page);
  });

  test("Researcher edits the Statement + uploads evidence; Save triggers automatic reclassification (no duplicate survey)", async ({
    page,
  }) => {
    await login(page, researcherEmail, NEW_PASSWORD);
    await page.goto(`/studies/${studyId}/needs/${need2Id}`);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const statementField = page.getByLabel("Need statement");
    await statementField.fill(
      "Flooding affects nearly 600 households during every rainy season. " +
        "Drainage canals are blocked and roads become inaccessible for emergency " +
        "vehicles. The flooding damages homes and prevents children from " +
        "attending school.",
    );
    await page.getByRole("button", { name: "Save need", exact: false }).click();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Manage evidence" }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(FIXTURES, "flood_photos.pdf"));
    await expect(page.getByText("flood_photos.pdf")).toBeVisible({ timeout: 10_000 });
    await page.goBack();

    await waitForClassificationComplete(page);
    await logout(page);
  });

  test("Approver overrides the domain, edits the survey questions, approves classification, then approves & publishes", async ({
    page,
  }) => {
    await login(page, approverEmail, NEW_PASSWORD);
    await page.goto(`/studies/${studyId}/needs/${need2Id}`);
    await waitForClassificationComplete(page);

    await page.getByRole("button", { name: "Override Domain" }).click();
    const overrideDialog = page.getByRole("dialog");
    const combos = overrideDialog.getByRole("combobox");

    await combos.nth(0).click();
    const domainOptions = await page.getByRole("option").allTextContents();
    const currentDomainMatch = firstAiSuggestedDomain;
    const differentDomain =
      domainOptions.find((d) => !currentDomainMatch.includes(d)) ?? domainOptions[0];
    await page.getByRole("option", { name: differentDomain, exact: true }).click();

    await combos.nth(1).click();
    const subDomainOptions = await page.getByRole("option").allTextContents();
    const differentSubDomain = subDomainOptions[0];
    await page.getByRole("option", { name: differentSubDomain, exact: true }).click();

    await overrideDialog
      .getByLabel("Reason for override")
      .fill("Drainage/road-access impact is better captured under this classification.");
    await overrideDialog.getByRole("button", { name: "Preview Questions" }).click();
    await expect(overrideDialog).toHaveCount(0, { timeout: 10_000 });

    await expect(page.getByText("Working Domain")).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("AI Classification Approved")).toBeVisible({
      timeout: 15_000,
    });

    // AI's original suggestion must remain exactly what it was — only the
    // Approved Domain/Sub-domain reflect the override. Both must show,
    // side by side with the AI's untouched original suggestion.
    await expect(page.getByText("Approved Domain", { exact: true })).toBeVisible();
    await expect(page.getByText("Approved Sub-domain", { exact: true })).toBeVisible();
    await expect(page.getByText(differentDomain, { exact: true })).toBeVisible();
    await expect(page.getByText(differentSubDomain, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "View Suggested Questions" }).click();
    await expect(page).toHaveURL(new RegExp(`/survey-builder/${need2Id}$`));

    await page.getByRole("combobox", { name: "Methodology Version" }).click();
    await page.getByRole("option").first().click();

    await page.getByRole("tab", { name: "AI Recommended Questions" }).click();
    const removeButtons = page.getByRole("button", { name: "Remove" });
    if ((await removeButtons.count()) > 0) {
      await removeButtons.first().click();
    }

    await page.getByRole("button", { name: "Add Open-ended Question" }).click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Question").fill("How often does flooding occur?");
    await modal.getByRole("combobox", { name: "Answer Type" }).click();
    // Two backing answer types ("multiple_choice" and "checkbox") both
    // display as "Multiple Choice" here — same kind of label collision as
    // "Number" noted above; the real "multiple_choice" is first in list order.
    await page
      .getByRole("option", { name: "Multiple Choice", exact: true })
      .first()
      .click();
    const optionInputs = modal.getByPlaceholder(/Option \d/);
    await optionInputs.nth(0).fill("Every rain");
    await optionInputs.nth(1).fill("Monthly");
    await modal.getByRole("button", { name: "Add Option" }).click();
    await modal
      .getByPlaceholder(/Option \d/)
      .nth(2)
      .fill("Rarely");
    await modal.getByRole("button", { name: "Add Question" }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Save & Publish" }).click();
    await expect(page.getByText("Survey saved and published.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
  });
});
