import { expect, test } from "@playwright/test";

test("login with a seeded demo account reaches the dashboard", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Work email").fill("admin@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Demo NGO")).toBeVisible();
});

test("sidebar collapse toggle lives in the topbar and collapses the sidebar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveClass(/w-64/);

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(sidebar).toHaveClass(/w-16/);

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(sidebar).toHaveClass(/w-64/);
});

test("login shows an error for wrong credentials", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Work email").fill("admin@demo-ngo.org");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("a role without read access to a module doesn't see its nav item", async ({
  page,
}) => {
  // Research Officer has no access to entityTeam/rolesPermissions per the seed matrix.
  await page.goto("/");
  await page.getByLabel("Work email").fill("officer@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Organization" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Roles" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
});

test("direct URL navigation to an unauthorized page redirects away", async ({ page }) => {
  // Research Officer lacks read access to entityTeam/rolesPermissions.
  // Typing the URL directly must be blocked, not just the nav link hidden.
  await page.goto("/");
  await page.getByLabel("Work email").fill("officer@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/organization");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/roles");
  await expect(page).toHaveURL(/\/dashboard$/);
});

// POST /users (invite) creates the row but never provisions a password —
// unlike self-signup, there's no temp-password issuance for an
// admin-invited user yet, so they have no way to ever log in at all.
// Flip back to test() once invite provisions credentials (temp password +
// email, mirroring AuthService.signup()).
test.skip("an admin-invited user is never prompted for consent — the NGO Admin consents for the org", async ({
  page,
}) => {
  const email = `invitee.${Date.now()}@demo.org`;

  // Admin creates a new user.
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Name").fill("Nadia Khan");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "Research Officer" }).click();
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Other tests in this file add users to the same shared mock store, so
  // the new user isn't guaranteed to land on page 1 — filter for it.
  await page.getByPlaceholder("Search by name or email...").fill(email);
  await expect(page.getByText(email)).toBeVisible();

  // Creating a user doesn't disturb the admin's own already-consented session.
  await expect(page.getByText("Before you continue")).toHaveCount(0);

  // Log out, log in as the newly created user.
  await page.getByRole("button", { name: "Sarah" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // A Research Officer is covered by the admin's org-level acceptance, so
  // the gate never appears — they land straight in the app.
  await expect(page.getByRole("heading", { name: "Welcome, Nadia Khan" })).toBeVisible();
  await expect(page.getByText("Before you continue")).toHaveCount(0);
});

test("cross-entity access is prevented between organizations", async ({ page }) => {
  // admin@demo-ngo.org (Demo NGO) and admin@riverside-ngo.org (Riverside
  // Community Trust) are seeded into two different organizations. Neither
  // should ever see the other's team — this is the acceptance criterion
  // the RBAC backbone and entity-separation user stories (RIO-NFR-003,
  // RIO-RBAC-001) are built around, now proven against the real backend.
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@riverside-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Riverside Community Trust")).toBeVisible();
  await expect(page.getByText("Demo NGO")).toHaveCount(0);

  await page.goto("/settings/users");
  // Scoped to the page content — the topbar's user-menu button also shows
  // "Riverside Admin" (the signed-in admin's own name), which would
  // otherwise make this locator ambiguous.
  const main = page.getByRole("main");
  await expect(main.getByText("Riverside Admin")).toBeVisible();
  // None of Demo NGO's seeded users should leak into Riverside's list.
  await expect(main.getByText("Sarah")).toHaveCount(0);
  await expect(main.getByText("Amira")).toHaveCount(0);
});

test("roles page shows a card per role and a per-module access table on view", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/roles");

  // Scoped to the page content — the topbar's user-menu button also shows
  // "NGO Admin" (the signed-in admin's own role), which would otherwise
  // make this locator ambiguous.
  const main = page.getByRole("main");

  // Only the 4 roles enabled for the current demo phase render as cards —
  // System Admin/Field Researcher/Data Analyst/Read-only Viewer/Citizen Guest
  // stay fully defined in roles.ts but are hidden (enabled: false) until the
  // team lead brings them back — see the pivot note atop roles.ts.
  await expect(main.getByText("NGO Admin")).toBeVisible();
  await expect(main.getByText("Research Officer")).toBeVisible();
  await expect(main.getByText("Reviewer / Approver")).toBeVisible();
  await expect(main.getByText("Program Supervisor")).toBeVisible();
  await expect(main.getByText("System Admin")).toHaveCount(0);
  await expect(main.getByText("Citizen / Beneficiary Guest")).toHaveCount(0);

  // Center Supervisor is the only cross-entity role enabled right now.
  await expect(main.getByText("Cross-entity", { exact: true })).toHaveCount(1);

  // Opening a role's detail shows one access-level badge per module, plus
  // elevated actions called out only where they apply — not a grid of ticks.
  const adminCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "NGO Admin" })
    .first();
  await adminCard.getByRole("button", { name: "View details" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "NGO Admin" })).toBeVisible();
  await expect(sheet.getByText("Study & Survey Management")).toBeVisible();
  await expect(sheet.getByText("Full Access").first()).toBeVisible();
  // NGO Admin has full access, including the elevated actions.
  await expect(sheet.getByText("Approve · Export · Share").first()).toBeVisible();
});

test("clicking a user row opens a detail sheet with role, status and module access", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  await page.getByRole("row", { name: /Amira/ }).click();

  // Scoped to the sheet — the table row behind it repeats the same name/email text.
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Amira" })).toBeVisible();
  await expect(sheet.getByText("officer@demo-ngo.org")).toBeVisible();
  await expect(sheet.getByText("Module access")).toBeVisible();
  await expect(sheet.getByText("Data Collection")).toBeVisible();

  // Edit from inside the sheet opens the same dialog used for creating a user.
  await sheet.getByRole("button", { name: "Edit user" }).click();
  await expect(page.getByRole("heading", { name: "Edit user" })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Amira");
});

test("users table paginates once results exceed the page size", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo-ngo.org");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible();

  // The backend's seeded org is shared across tests in this file (and
  // across repeated local runs), so top up to more than one page's worth
  // rather than assuming an exact starting count.
  while (
    !(await page
      .getByText(/Page \d+ of \d+/)
      .isVisible()
      .catch(() => false))
  ) {
    await page.getByRole("button", { name: "New user" }).click();
    await page.getByLabel("Name").fill(`Pagination Test ${Date.now()}`);
    await page.getByLabel("Email").fill(`pagination.${Date.now()}@demo-ngo.org`);
    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: "Research Officer" }).click();
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();

  // Scoped to the pagination nav — "Next" alone also substring-matches
  // Next.js's dev-mode "Open Next.js Dev Tools" button.
  await page.getByRole("navigation").getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
});

test("otp sign-in flow with the mock code", async ({ page }) => {
  await page.goto("/otp");

  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByRole("button", { name: "Send code" }).click();

  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("public signup creates an organization and its first NGO Admin, who must change their temporary password before reaching the dashboard", async ({
  page,
}) => {
  const unique = Date.now();
  const orgName = `Sunrise Village Fund ${unique}`;
  const email = `meera.${unique}@sunrise-village.org`;

  await page.goto("/");
  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await page.getByLabel("Organization name").fill(orgName);
  await page.getByLabel("Area of work").fill("Community Health");
  await page.getByLabel("Registration number").fill(`REG-E2E-${unique}`);
  // Single email field — no separate admin name/email/password anymore;
  // the signup email itself becomes the NGO Admin account, and the backend
  // issues a temporary password instead of taking one from the form.
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create organization" }).click();

  // Dev-only reveal step: the generated temporary password, shown once
  // (no mailer configured in the e2e environment).
  await expect(
    page.getByRole("heading", { name: "Your account is ready" }),
  ).toBeVisible();
  const temporaryPassword = await page.getByLabel("Temporary password").inputValue();
  expect(temporaryPassword.length).toBeGreaterThan(0);

  // Signup no longer logs the admin straight in — it sends them back to
  // sign in explicitly, same as any returning user.
  await page.getByRole("button", { name: "Go to sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(temporaryPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // A signup-issued temp password forces a change before anything else in
  // the app is reachable — the dashboard itself doesn't render yet.
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Welcome, ${orgName} Admin` }),
  ).toHaveCount(0);

  // Must satisfy the set-password policy: 8+ chars, one capital, one
  // digit, one special character (see src/lib/password-policy.ts).
  const newPassword = "A-Brand-New-Password1";
  await page.getByLabel("Temporary password").fill(temporaryPassword);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();

  // A confirmation screen, not an instant swap to the dashboard — the old
  // (temporary) session is cleared, and the admin signs in explicitly with
  // the new password, same reasoning as signup's "go to sign in" step.
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Welcome, ${orgName} Admin` }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Go to sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  // No name field was collected — the derived placeholder name is used.
  // (Confirms the org name is present too — it's part of this heading.)
  await expect(
    page.getByRole("heading", { name: `Welcome, ${orgName} Admin` }),
  ).toBeVisible();

  // The old temporary password no longer works — it's dead once replaced.
  await page.getByRole("button", { name: `${orgName} Admin` }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(temporaryPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
});

test("signing up with an already-registered registration number is blocked", async ({
  page,
}) => {
  await page.goto("/signup");

  await page.getByLabel("Organization name").fill("Demo Nonprofit Alliance (duplicate)");
  await page.getByLabel("Area of work").fill("Livelihoods");
  // Matches Demo NGO's seeded registration number.
  await page.getByLabel("Registration number").fill("REG-DEMO-0001");
  await page.getByLabel("Email").fill(`second-admin-${Date.now()}@demo.org`);
  await page.getByRole("button", { name: "Create organization" }).click();

  await expect(
    page.getByText("An organization with this registration number already exists."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
