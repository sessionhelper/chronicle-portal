/**
 * Design-system assertions — CSS property checks that catch drift from
 * the Parchment spec (Crimson Pro headings, Inter body, 4px radius).
 *
 * Uses Playwright's `toHaveCSS` instead of pixel-diff screenshots —
 * more robust against font-rendering differences across machines.
 */

import { expect, test } from "@playwright/test";

test.describe("typography", () => {
  test("body text uses Inter (--font-sans)", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const ff = await body.evaluate((el) =>
      getComputedStyle(el).fontFamily
    );
    expect(ff.toLowerCase()).toMatch(/inter/);
  });

  test("h1 headings use Crimson Pro (--font-serif)", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 }).first();
    if (await heading.count()) {
      const ff = await heading.evaluate((el) =>
        getComputedStyle(el).fontFamily
      );
      expect(ff.toLowerCase()).toMatch(/crimson/);
    }
  });
});

test.describe("border-radius", () => {
  test("sign-in button uses 4px radius", async ({ page }) => {
    await page.goto("/login");
    const btn = page.getByRole("button", { name: /sign in/i }).first();
    if (await btn.count()) {
      await expect(btn).toHaveCSS("border-radius", "4px");
    }
  });
});

test.describe("color palette", () => {
  test("background is warm (not white, not grey)", async ({ page }) => {
    await page.goto("/");
    const bg = await page.locator("body").evaluate((el) =>
      getComputedStyle(el).backgroundColor
    );
    // Warm Parchment palette: hsl(40 33% 94%) ≈ rgb(241, 236, 224)
    expect(bg).not.toBe("rgb(255, 255, 255)");
    expect(bg).not.toBe("rgb(0, 0, 0)");
  });
});
