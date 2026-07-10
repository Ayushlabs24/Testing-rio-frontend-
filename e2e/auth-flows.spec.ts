import { expect, test } from "@playwright/test";

test("login with a seeded demo account reaches the dashboard", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Demo Nonprofit Alliance")).toBeVisible();
});

test("sidebar collapse toggle lives in the topbar and collapses the sidebar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("password123");
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

  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("a role without read access to a module doesn't see its nav item", async ({
  page,
}) => {
  // NGO Research Officer has no access to entityTeam/rolesPermissions per the seed matrix.
  await page.goto("/");
  await page.getByLabel("Work email").fill("officer@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Organization" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Roles" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
});

test("direct URL navigation to an unauthorized page redirects away", async ({ page }) => {
  // NGO Research Officer lacks read access to entityTeam/rolesPermissions.
  // Typing the URL directly must be blocked, not just the nav link hidden.
  await page.goto("/");
  await page.getByLabel("Work email").fill("officer@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/organization");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/roles");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("an admin-invited user is prompted for consent on first login, not the admin who created them", async ({
  page,
}) => {
  const email = `invitee.${Date.now()}@demo.org`;

  // Admin creates a new user.
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Name").fill("Nadia Khan");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "NGO Research Officer" }).click();
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Other tests in this file add users to the same shared mock store, so
  // the new user isn't guaranteed to land on page 1 — filter for it.
  await page.getByPlaceholder("Search by name or email...").fill(email);
  await expect(page.getByText(email)).toBeVisible();

  // Admin created the account but never consented on the invitee's behalf —
  // admin's own session must be unaffected.
  await expect(page.getByText("Before you continue")).toHaveCount(0);

  // Log out, log in as the newly created user.
  await page.getByRole("button", { name: "Alex Morgan" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Blocked by the consent gate before seeing any app content.
  await expect(page.getByText("Before you continue")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome, Nadia Khan" })).toHaveCount(0);

  await page.getByRole("button", { name: "I agree, continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Nadia Khan" })).toBeVisible();
});

test("cross-entity access is prevented between organizations", async ({ page }) => {
  // admin@demo.org (org_demo) and admin@riverside.org (org_second) are
  // seeded into two different organizations. Neither should ever see the
  // other's team — this is the acceptance criterion the RBAC backbone and
  // entity-separation user stories are built around.
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@riverside.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Riverside Community Trust")).toBeVisible();
  await expect(page.getByText("Demo Nonprofit Alliance")).toHaveCount(0);

  await page.goto("/settings/users");
  await expect(page.getByText("Devika Menon")).toBeVisible();
  await expect(page.getByText("Arun Pillai")).toBeVisible();
  // None of org_demo's seeded users should leak into org_second's list.
  await expect(page.getByText("Alex Morgan")).toHaveCount(0);
  await expect(page.getByText("Ryan Fernandes")).toHaveCount(0);
});

test("roles page shows a card per role and a per-module access table on view", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/roles");

  // All 9 roles from new scope.md render as cards.
  await expect(page.getByText("NGO Admin")).toBeVisible();
  await expect(page.getByText("System Admin")).toBeVisible();
  await expect(page.getByText("Citizen / Beneficiary Guest")).toBeVisible();

  // Cross-entity roles (System Admin, Center Supervisor) are badged as such.
  await expect(page.getByText("Cross-entity", { exact: true })).toHaveCount(2);

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
  await expect(sheet.getByText("Full access").first()).toBeVisible();
  // NGO Admin has full access, including the elevated actions.
  await expect(sheet.getByText("Approve · Export · Share").first()).toBeVisible();
});

test("clicking a user row opens a detail sheet with role, status and module access", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  await page.getByRole("row", { name: /Ryan Fernandes/ }).click();

  // Scoped to the sheet — the table row behind it repeats the same name/email text.
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Ryan Fernandes" })).toBeVisible();
  await expect(sheet.getByText("officer@demo.org")).toBeVisible();
  await expect(sheet.getByText("Module access")).toBeVisible();
  await expect(sheet.getByText("Data Collection")).toBeVisible();

  // Edit from inside the sheet opens the same dialog used for creating a user.
  await sheet.getByRole("button", { name: "Edit user" }).click();
  await expect(page.getByRole("heading", { name: "Edit user" })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Ryan Fernandes");
});

test("users table paginates once results exceed the page size", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible();

  // The mock store is shared across tests in this file, so top up to more
  // than one page's worth rather than assuming an exact starting count.
  while (
    !(await page
      .getByText(/Page \d+ of \d+/)
      .isVisible()
      .catch(() => false))
  ) {
    await page.getByRole("button", { name: "New user" }).click();
    await page.getByLabel("Name").fill(`Pagination Test ${Date.now()}`);
    await page.getByLabel("Email").fill(`pagination.${Date.now()}@demo.org`);
    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: "Field Researcher" }).click();
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  await expect(rows).toHaveCount(8);
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
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

test("System Admin creates an organization and its first NGO Admin in one step", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("sysadmin@rio.platform");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Dashboard is platform-wide, not one organization's numbers.
  await expect(
    page.getByText("A platform-wide view across every organization."),
  ).toBeVisible();
  await expect(page.getByText("Active Studies")).toBeVisible();
  await expect(page.getByText("Pending Reviews")).toBeVisible();
  await expect(page.getByText("Reports Generated")).toBeVisible();

  // System Admin sees the cross-entity "Organizations" screen and a
  // platform-wide "Users" screen, but not the single-org "Organization"
  // profile page — that one only applies to an entity role's own org.
  await expect(page.getByRole("link", { name: "Organizations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Organization", exact: true })).toHaveCount(
    0,
  );

  // Nav-hiding isn't enough on its own — direct URL navigation to the
  // single-org profile screen must redirect a cross-entity role away too.
  await page.goto("/settings/organization");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/organizations");
  await expect(page.getByText("Demo Nonprofit Alliance")).toBeVisible();
  await expect(page.getByText("Riverside Community Trust")).toBeVisible();

  const orgName = `Coastal Relief Network ${Date.now()}`;
  const adminEmail = `admin.${Date.now()}@coastalrelief.org`;

  await page.getByRole("button", { name: "New organization" }).click();
  await page.getByLabel("Organization name").fill(orgName);
  await page.getByLabel("Region").fill("Andhra Pradesh, India");
  await page.getByRole("combobox", { name: "Sector" }).click();
  await page.getByRole("option", { name: "Disaster Relief" }).click();
  await page.getByLabel("Contact email").fill("contact@coastalrelief.org");
  await page.getByLabel("Name", { exact: true }).fill("Meera Rao");
  await page.getByLabel("Email", { exact: true }).fill(adminEmail);
  await page.getByRole("button", { name: "Create organization" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(orgName)).toBeVisible();

  // The new org's NGO Admin can log in immediately — entity separation
  // still holds: they only see their own, brand-new organization.
  await page.getByRole("button", { name: "Morgan Lee" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");

  await page.getByLabel("Work email").fill(adminEmail);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Created the same way an admin-invited user is (not yet consented), so
  // the new NGO Admin hits the consent gate on their first login too.
  await expect(page.getByText("Before you continue")).toBeVisible();
  await page.getByRole("button", { name: "I agree, continue" }).click();

  await expect(page.getByText(orgName)).toBeVisible();
});

test("System Admin views and edits an organization, and links out to Users for its roster", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("sysadmin@rio.platform");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/organizations");

  // Clicking a row opens the detail sheet — same pattern as the Users page.
  await page.getByRole("row", { name: /Riverside Community Trust/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "Riverside Community Trust" }),
  ).toBeVisible();

  // Existing members are visible without any extra navigation.
  await expect(sheet.getByText("Devika Menon")).toBeVisible();
  await expect(sheet.getByText("Arun Pillai")).toBeVisible();

  // Edit — System Admin can change an organization's details, not just view them.
  const regionField = sheet.getByLabel("Region");
  await regionField.fill("Kerala, India (Updated)");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet.getByText("Saving...")).toHaveCount(0);

  // Members are managed on the Users page, not duplicated here — a link out is enough.
  await sheet.getByRole("link", { name: "Manage in Users" }).click();
  await expect(page).toHaveURL(/\/settings\/users$/);
});

test("System Admin adds a user to any organization from a single, org-aware Users page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Work email").fill("sysadmin@rio.platform");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/users");

  // Platform-wide: users from both seeded organizations are reachable in the
  // same list (paginated, so search rather than assume page-1 position).
  await expect(page.getByText("Alex Morgan")).toBeVisible();
  await page.getByPlaceholder("Search by name or email...").fill("Devika Menon");
  await expect(page.getByText("Devika Menon")).toBeVisible();
  await page.getByPlaceholder("Search by name or email...").fill("");

  const memberEmail = `reviewer.${Date.now()}@riverside.org`;
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Name").fill("Kiran Das");
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByRole("combobox", { name: "Organization" }).click();
  await page.getByRole("option", { name: "Riverside Community Trust" }).click();
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "Human Reviewer" }).click();
  await page.getByRole("button", { name: "Create user" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByPlaceholder("Search by name or email...").fill("Kiran");
  await expect(page.getByText("Kiran Das")).toBeVisible();
  await expect(page.getByText("Riverside Community Trust")).toBeVisible();

  // System Admin can edit any user, from any organization.
  await page.getByText("Kiran Das").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Riverside Community Trust")).toBeVisible();
  await sheet.getByRole("button", { name: "Edit user" }).click();
  await page.getByLabel("Name").fill("Kiran D. Reviewer");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Kiran D. Reviewer")).toBeVisible();
});
