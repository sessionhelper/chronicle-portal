/**
 * Smoke: public surfaces render and redirect rules hold. The signed-in
 * path (sign-in → dashboard → view a session) requires a running
 * data-api with a seeded session (via `chronicle-feeder/scripts/
 * inject-session.py`) + a valid Discord OAuth app; it's gated on
 * `E2E_LIVE=1` so the smoke can run headless without those deps.
 */

import { expect, test } from "@playwright/test";

test("landing page renders the sign-in CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chronicle" })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
});

test("login page surfaces the Discord button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/sign in to chronicle/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in with discord/i }),
  ).toBeVisible();
});

test("dashboard redirects unauthenticated visitors to /login", async ({
  page,
}) => {
  const res = await page.goto("/dashboard");
  // Middleware should have punted us to the login page.
  await expect(page).toHaveURL(/\/login/);
  expect(res?.ok() || res?.status() === 304).toBeTruthy();
});

test.describe("signed-in flow", () => {
  test.skip(
    process.env.E2E_LIVE !== "1",
    "Requires E2E_LIVE=1 with a live data-api + seeded session",
  );

  test("sign-in → dashboard → view a session", async ({ page }) => {
    // With E2E_LIVE=1 we assume an OAuth bypass cookie or test identity
    // has been set up out-of-band (e.g. by a dev-only Auth.js provider).
    await page.goto("/dashboard");
    await expect(page.getByText(/your sessions/i)).toBeVisible();
    await page.getByRole("link", { name: /view all/i }).click();
    await expect(page).toHaveURL(/\/sessions/);
    // Click the first session card if present.
    const firstSession = page.locator("a[href^='/sessions/']").first();
    if (await firstSession.count()) {
      await firstSession.click();
      await expect(page.getByRole("heading", { name: /transcript/i })).toBeVisible();
    }
  });
});
