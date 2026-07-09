import { expect, test } from "@playwright/test";

test("login page renders at the app root", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in with OTP instead" }),
  ).toBeVisible();
});

test("theme toggle cycles system -> light -> dark", async ({ page }) => {
  await page.goto("/");

  const toggle = page.getByRole("button", { name: /toggle theme/i });
  await expect(toggle).toBeVisible();

  await toggle.click(); // system -> light
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await toggle.click(); // light -> dark
  await expect(page.locator("html")).toHaveClass(/dark/);

  // Hero headline must stay legible in dark mode (fixed on-brand token, not the
  // theme-flipping primary-foreground token which would go near-black here).
  const heading = page.getByRole("heading", {
    name: "One platform for your entire community needs assessment lifecycle",
  });
  await expect(heading).toBeVisible();

  const lightness = await heading.evaluate((el) => {
    const color = getComputedStyle(el).color;
    const lab = color.match(/^lab\(([\d.]+)/);
    if (lab) return Number(lab[1]); // lab() lightness is already 0-100
    const rgb = color.match(/rgb\((\d+)/);
    return rgb ? (Number(rgb[1]) / 255) * 100 : 0;
  });
  expect(lightness).toBeGreaterThan(90);
});
