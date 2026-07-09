import { expect, test } from "@playwright/test";

test("signup creates a new organization and lands on the dashboard", async ({ page }) => {
  await page.goto("/signup");

  await page.getByLabel("Organisation name").fill("Rivertown Relief");
  await page.getByLabel("Your name").fill("Jordan Lee");
  await page.getByLabel("Work email").fill(`jordan.${Date.now()}@rivertown.org`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Rivertown Relief")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Welcome, Jordan Lee/ })).toBeVisible();

  // Org Admin (the default role for whoever creates the org) sees every nav item.
  await expect(page.getByRole("link", { name: "Organization" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Roles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
});

test("login with a seeded demo account reaches the dashboard", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Demo Nonprofit Alliance")).toBeVisible();
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
  // Research Officer has no access to organization/usersRoles per the seed matrix.
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
  // Research Officer lacks read access to organization/usersRoles. Typing the
  // URL directly must be blocked, not just the nav link hidden.
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
  await page.getByRole("option", { name: "Research Officer" }).click();
  await page.getByRole("button", { name: "Create user" }).click();
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

test("otp sign-in flow with the mock code", async ({ page }) => {
  await page.goto("/otp");

  await page.getByLabel("Work email").fill("admin@demo.org");
  await page.getByRole("button", { name: "Send code" }).click();

  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});
