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

  // Measure the rendered color the engine-agnostic way: paint it onto a 1x1
  // canvas and read the RGB back, then compute perceived lightness (0-100).
  // getComputedStyle().color serialization differs by engine and color space
  // (Tailwind v4 authors in oklch), so string-matching one format is brittle
  // and returns 0 on browsers that report oklch/oklab/color().
  const lightness = await heading.evaluate((el) => {
    const color = getComputedStyle(el).color;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100;
  });
  expect(lightness).toBeGreaterThan(90);
});
