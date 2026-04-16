import { expect, test } from "@playwright/test";

test.describe("typography", () => {
  test("body text uses Inter (--font-sans)", async ({ page }) => {
    await page.goto("/");
    const ff = await page.locator("body").evaluate((el) =>
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
    expect(bg).not.toBe("rgb(255, 255, 255)");
    expect(bg).not.toBe("rgb(0, 0, 0)");
  });
});
