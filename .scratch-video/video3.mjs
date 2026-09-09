import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001/ar";
const API_BASE = "http://localhost:3000/api";
const OUT_DIR =
  "/private/tmp/claude-501/-Users-aparnasayi-Desktop-RIO-PROJECT/2ef7d6c6-704a-4964-8939-942240c0b26e/scratchpad/video3_out";
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const SYSADMIN = { email: "sysadmin@platform.local", password: "Passw0rd!" };
const SYSREVIEWER = { email: "sysreviewer@platform.local", password: "Passw0rd!" };
const DATA_ANALYST = { email: "fasill@yopmail.com", password: "Passw0rd!" };

// From the off-camera setup (setup3.mjs) — the education study/needs
// carried over from Video 2, now with approved priority scores, plus a
// second Need (different village) for Village Comparison, and a real
// published survey link for the Question Bank deactivation demo.
const STUDY_TITLE = "تقييم احتياجات التعليم في محافظة الدوادمي - الدورة الثانية";
const NEED1_TITLE = "اكتظاظ الفصول الدراسية في المدارس الحكومية";
const PUBLIC_SURVEY_URL = "http://localhost:3001/public/survey/sGz_EEgmmBB0C6jSPz5CcCAC8CgrEyNI";
// Each deactivate/reactivate submits a whole new *version* row of the
// question (found the hard way: the id below went stale after exactly one
// deactivate/reactivate cycle, pointing at a no-longer-current version) —
// so the id used for the off-camera approval call is always looked up
// fresh via getCurrentQuestionId(), never hardcoded.

const NEW_QUESTION_ID = "EDU-99";
const NEW_QUESTION_TEXT =
  "هل تتوفر في المدرسة مساحات آمنة ومخصصة للأنشطة الرياضية والترفيهية للطلاب؟";
const NEW_QUESTION_INDICATOR = "توفر المساحات الرياضية";
const NEW_QUESTION_KPI = "EDU-99 — نسبة المدارس التي تضم ملاعب أو مساحات أنشطة آمنة";

const SCRIPT_START = Date.now();
function step(name) {
  const elapsed = ((Date.now() - SCRIPT_START) / 1000).toFixed(1);
  console.log(`>> [${elapsed}s] ${name}`);
}

async function beat(page, ms = 1200) {
  await page.waitForTimeout(ms);
}
async function hold(page, ms = 2500) {
  await page.waitForTimeout(ms);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await beat(page, 1300);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForSelector('[data-slot="avatar"]', { timeout: 15000 }).catch(() => {});
  await beat(page, 900);
}

async function logout(page) {
  if (await page.locator("#email").count()) return;
  await page.locator('button:has([data-slot="avatar"])').first().click();
  await beat(page, 500);
  await page.getByText("تسجيل الخروج").click();
  await page.waitForSelector("#email", { timeout: 10000 }).catch(() => {});
  await beat(page, 500);
}

async function nav(page, linkName) {
  // exact:true — some dashboard landing pages also have a card whose own
  // accessible name starts with the same sidebar link text plus a longer
  // description, which an unscoped/partial match catches too.
  await page.getByRole("link", { name: linkName, exact: true }).click();
  await beat(page, 1000);
}

async function scrollToAndPause(locator, ms = 900) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await locator.page().waitForTimeout(ms);
}

async function fillSlowly(locator, value, pauseAfter = 500) {
  await locator.click();
  await locator.fill(value);
  await locator.page().waitForTimeout(pauseAfter);
}

async function openQuestionBankTab(page) {
  await nav(page, "إعدادات المنهجية");
  await page.getByRole("tab", { name: "بنك الأسئلة" }).click();
  await beat(page, 1200);
}

// Off-camera approval — System Reviewer approving a pending Question Bank
// change (deactivate/reactivate) via a direct API call, invisible to the
// recorded browser. Used only for the reactivation's approval, to avoid a
// second full role-switch cycle on camera right after the deactivation one
// already showed exactly this mechanism in full.
async function authFetch(credentials) {
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!loginRes.ok) throw new Error(`background login failed: ${loginRes.status}`);
  const setCookies = loginRes.headers.getSetCookie();
  const cookieJar = Object.fromEntries(
    setCookies.map((c) => {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      return [pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()];
    }),
  );
  const cookieHeader = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return async (p, options = {}) =>
    fetch(`${API_BASE}${p}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "x-csrf-token": cookieJar.rio_csrf ?? "",
        ...(options.headers || {}),
      },
    });
}

// A submitted (not-yet-approved) change creates its own version row with
// approvalStatus "pending_approval" — isCurrentVersion only flips to it
// once approved, so the row to act on is the pending one, not "whichever
// version is current". The pending-approvals endpoint itself needs
// methodologyQuestionBank:approve, which System Admin (the recorded page's
// current session at this point) doesn't hold — so this uses the System
// Reviewer's own session throughout, not page.request.
async function approveReactivationInBackground(questionCode) {
  step("(off-camera) System Reviewer approves the reactivation via API");
  const asReviewer = await authFetch(SYSREVIEWER);
  const pendingRes = await asReviewer("/question-bank/questions/pending-approvals");
  if (!pendingRes.ok) {
    throw new Error(`pending-approvals lookup failed: ${pendingRes.status}`);
  }
  const pendingList = await pendingRes.json();
  const pending = pendingList.find((q) => q.questionId === questionCode);
  if (!pending) throw new Error(`no pending version found for ${questionCode}`);
  const res = await asReviewer(`/question-bank/questions/${pending.id}/approve`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`background reactivation approve failed: ${res.status}`);
}

async function prewarmRoutes() {
  const routes = [
    "/",
    "/dashboard",
    "/settings/methodology",
    "/priority-dashboard",
    "/priority-dashboard/village-comparison",
  ];
  for (const route of routes) {
    await fetch(`${BASE}${route}`).catch(() => {});
  }
}

(async () => {
  await prewarmRoutes();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
    locale: "ar-SA",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const issues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push(`console error: ${msg.text()}`);
  });

  try {
    // ================= PART D: Question Bank =================
    step("D1: login as System Admin, open Question Bank");
    await login(page, SYSADMIN.email, SYSADMIN.password);
    await openQuestionBankTab(page);
    await hold(page, 1400);

    step("D2: add a new education-related question");
    await page.getByRole("button", { name: "إضافة سؤال" }).click();
    await beat(page, 900);
    const createDialog = page.getByRole("dialog");
    await fillSlowly(page.locator("#create-question-id"), NEW_QUESTION_ID, 500);

    await createDialog.getByText("المجال", { exact: true }).click();
    await beat(page, 500);
    await page.getByRole("option", { name: "التعليم", exact: true }).click();
    await beat(page, 600);

    await createDialog.getByText("المجال الفرعي", { exact: true }).click();
    await beat(page, 500);
    await page.getByRole("option", { name: "البنية المدرسية", exact: true }).click();
    await beat(page, 600);

    await fillSlowly(page.locator("#create-indicator"), NEW_QUESTION_INDICATOR, 400);
    await fillSlowly(page.locator("#create-kpi"), NEW_QUESTION_KPI, 400);
    await fillSlowly(page.locator("#create-question-text"), NEW_QUESTION_TEXT, 600);

    // Show the Answer Type options — open-ended is available, and there is
    // no Target Sector field anywhere in this form.
    // By now the dialog has 4 comboboxes (domain, sub-domain, answer type,
    // required/optional) — index 2 is Answer Type, not .first() (that's
    // still the domain select from earlier).
    await createDialog.getByRole("combobox").nth(2).click();
    await beat(page, 600);
    await page.getByRole("option", { name: "مفتوح (نص حر)" }).click();
    await hold(page, 2200);

    await createDialog.getByRole("button", { name: "إضافة السؤال" }).click();
    await page
      .getByText("تم إرسال التغيير", { exact: false })
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => issues.push("new question success message did not appear"));
    await hold(page, 2200);

    step("D3: find EDU-11 — already used by a published survey");
    await page.getByPlaceholder("ابحث برقم السؤال أو النص أو المؤشر أو مؤشر الأداء...").fill("EDU-11");
    await beat(page, 900);
    const edu11Row = page.locator("tr", { hasText: "EDU-11" });
    await scrollToAndPause(edu11Row, 1400);

    step("D4: submit EDU-11 for deactivation");
    await edu11Row.getByRole("button", { name: "الإجراءات" }).click();
    await beat(page, 600);
    await page.getByRole("menuitem", { name: "إلغاء التفعيل" }).click();
    await page
      .getByText("تم إرسال التغيير", { exact: false })
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => issues.push("deactivate success message did not appear"));
    await hold(page, 2200);

    step("D5: System Reviewer approves the deactivation");
    await logout(page);
    await login(page, SYSREVIEWER.email, SYSREVIEWER.password);
    await openQuestionBankTab(page);
    const pendingRow = page.locator("tr", { hasText: "EDU-11" });
    await scrollToAndPause(pendingRow, 1200);
    await pendingRow.getByRole("button", { name: "موافقة" }).click();
    await hold(page, 2200);

    step("D6: confirm EDU-11 now shows inactive");
    await page.reload({ waitUntil: "load" });
    await openQuestionBankTab(page);
    await page.getByPlaceholder("ابحث برقم السؤال أو النص أو المؤشر أو مؤشر الأداء...").fill("EDU-11");
    await beat(page, 900);
    await scrollToAndPause(page.locator("tr", { hasText: "EDU-11" }), 2200);

    step("D7: open the public link, go through OTP, show the question is still live there");
    await page.goto(PUBLIC_SURVEY_URL, { waitUntil: "load" });
    await beat(page, 1200);
    await page.getByRole("button", { name: "بدء الاستبيان" }).click();
    await beat(page, 900);

    await fillSlowly(page.locator("#citizen-name"), "مستجيب تجريبي", 300);
    await fillSlowly(page.locator("#citizen-mobile"), "+966500000099", 300);
    await fillSlowly(page.locator("#citizen-email"), "respondent-demo@yopmail.com", 300);
    await page.locator("#citizen-age-bracket").click();
    await beat(page, 400);
    await page.getByRole("option", { name: "35–44", exact: true }).click();
    await beat(page, 400);
    await page.locator("#citizen-consent").click();
    await beat(page, 500);
    // The OTP step itself isn't worth dwelling on — read the dev-mode code
    // straight off the page (no SMS provider configured locally) and move
    // through it quickly, landing on the actual question.
    await page.getByRole("button", { name: "بدء الاستبيان" }).click();
    await page.waitForSelector("#citizen-otp", { timeout: 10000 }).catch(() => {});
    const devCode = await page
      .locator("p.font-mono")
      .first()
      .textContent()
      .catch(() => null);
    if (devCode) {
      await page.locator("#citizen-otp").fill(devCode.trim());
      await page.getByRole("button", { name: "تحقق" }).click();
    } else {
      issues.push("dev OTP code was not found on the page");
    }

    // Land on the actual question screen — EDU-11, still answerable despite
    // being marked inactive in the Question Bank.
    await page
      .getByText("هل تتوفر في المدرسة التي يرتادها أطفالك", { exact: false })
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => issues.push("public survey question did not render after OTP"));
    await hold(page, 2800);

    step("D8: reactivate EDU-11 — deactivation is reversible, not a delete");
    // We're still on the public survey page from D7 — no session, no
    // avatar button there, so logout() has nothing to click. Head back
    // into the app first.
    await page.goto(`${BASE}/settings/methodology`, { waitUntil: "load" });
    // System Reviewer only holds approve here, not write — switch back to
    // System Admin (who submitted the deactivation earlier) to submit the
    // reactivation too.
    await logout(page);
    await login(page, SYSADMIN.email, SYSADMIN.password);
    await openQuestionBankTab(page);
    await page.getByPlaceholder("ابحث برقم السؤال أو النص أو المؤشر أو مؤشر الأداء...").fill("EDU-11");
    await beat(page, 900);
    const reactivateRow = page.locator("tr", { hasText: "EDU-11" });
    await scrollToAndPause(reactivateRow, 900);
    await reactivateRow.getByRole("button", { name: "الإجراءات" }).click();
    await beat(page, 600);
    await page.getByRole("menuitem", { name: "تفعيل" }).click();
    await page
      .getByText("تم إرسال التغيير", { exact: false })
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => issues.push("reactivate success message did not appear"));
    await beat(page, 1200);

    await approveReactivationInBackground("EDU-11");

    await page.reload({ waitUntil: "load" });
    await openQuestionBankTab(page);
    await page.getByPlaceholder("ابحث برقم السؤال أو النص أو المؤشر أو مؤشر الأداء...").fill("EDU-11");
    await beat(page, 900);
    await scrollToAndPause(page.locator("tr", { hasText: "EDU-11" }), 2200);

    // ================= PART E: Priority Score + Decisions =================
    step("E1: login as Data Analyst — open the Priority Score breakdown");
    await logout(page);
    await login(page, DATA_ANALYST.email, DATA_ANALYST.password);
    await nav(page, "لوحة الأولويات");
    await page.waitForSelector("table tbody tr", { timeout: 10000 }).catch(() => {});
    await page.getByRole("link", { name: NEED1_TITLE, exact: true }).click();
    await beat(page, 1200);

    await page.getByRole("tab", { name: "2. درجة الأولوية", exact: true }).click();
    await beat(page, 900);
    await scrollToAndPause(page.getByText("تفصيل درجة الأولوية", { exact: true }), 2600);

    step("E2: assign a Gap Type and log a decision");
    await page.getByRole("tab", { name: "القرارات", exact: true }).click();
    await beat(page, 900);
    const gapTypeSelect = page.getByLabel("نوع الفجوة", { exact: true });
    await scrollToAndPause(gapTypeSelect, 900);
    await gapTypeSelect.click();
    await beat(page, 500);
    await page.getByRole("option", { name: "حادة", exact: true }).click();
    await hold(page, 2000);

    await page.getByRole("button", { name: "تسجيل قرار" }).click();
    await beat(page, 800);
    const decisionDialog = page.getByRole("dialog");
    await decisionDialog.getByRole("combobox").first().click();
    await beat(page, 500);
    await page.getByRole("option", { name: "تدخل", exact: true }).click();
    await beat(page, 500);
    await fillSlowly(
      page.locator("#decision-responsible-party"),
      "الإدارة التعليمية بمحافظة الدوادمي",
      500,
    );
    await beat(page, 400);
    await fillSlowly(page.locator("#decision-notes"), "متابعة توفير البنية التحتية اللازمة للمدرسة.", 600);
    await decisionDialog.getByRole("button", { name: "حفظ" }).click();
    await hold(page, 2200);

    step("E3: progress the decision status open -> in progress -> completed");
    // Scoped to the decision's own list item (not .last() on the page's
    // comboboxes) — the Gap Type select above is also role="combobox" and
    // stays mounted on the same tab.
    const decisionItem = page.locator("li", { hasText: "تدخل" });
    const statusSelect = decisionItem.getByRole("combobox");
    await scrollToAndPause(statusSelect, 900);
    await statusSelect.click();
    await beat(page, 500);
    await page.getByRole("option", { name: "قيد التنفيذ", exact: true }).click();
    await hold(page, 1800);

    await statusSelect.click();
    await beat(page, 500);
    await page.getByRole("option", { name: "مكتمل", exact: true }).click();
    await hold(page, 1800);

    step("E4: show the decision's status history timeline");
    const historyToggleLink = page.getByText(/عرض السجل/, { exact: false }).first();
    await scrollToAndPause(historyToggleLink, 900);
    await historyToggleLink.click();
    await scrollToAndPause(decisionItem, 2800);

    // ================= PART F: Configurable Lists under Methodology =================
    step("F1: Study Types / Target Sectors / Decision Types / Gap Types — all configurable");
    await page.goto(`${BASE}/settings/methodology`, { waitUntil: "load" });
    await page.getByRole("tab", { name: "العتبات والأعلام والإصدار" }).click();
    await beat(page, 1000);
    for (const heading of ["أنواع الدراسة", "القطاعات المستهدفة", "أنواع القرارات", "أنواع الفجوة"]) {
      await scrollToAndPause(page.getByText(heading, { exact: true }).first(), 2200);
    }

    // ================= PART G: Village Comparison =================
    step("G1: compare villages within the same study");
    await page.goto(`${BASE}/priority-dashboard/village-comparison`, { waitUntil: "load" });
    await beat(page, 1000);
    await page.getByText("اختر دراسة واحدة أو أكثر", { exact: true }).click();
    await beat(page, 600);
    await page.locator('[role="listbox"]').getByText(STUDY_TITLE, { exact: true }).click();
    await page.keyboard.press("Escape");
    await beat(page, 900);
    // Scroll down to the actual comparison cards, not just the picker that
    // produced them.
    await scrollToAndPause(page.getByText("درجة الأولوية", { exact: true }).first(), 2800);
  } catch (err) {
    issues.push(`script error: ${err?.message ?? err}`);
    try {
      const url = page.url();
      const bodyText = (await page.locator("body").innerText()).slice(0, 1400);
      fs.writeFileSync(path.join(OUT_DIR, "error-context.txt"), `URL: ${url}\n\n${bodyText}`);
    } catch {}
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, "issues.json"), JSON.stringify(issues, null, 2));
    await context.close();
    await browser.close();
  }
})();
