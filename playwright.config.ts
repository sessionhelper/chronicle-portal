import { defineConfig, devices } from "@playwright/test";

/**
 * Minimum smoke-test harness. `npm run test:e2e` spins up the Next.js
 * dev server and hits the public pages; the signed-in flow uses
 * `E2E_LIVE=1` + a seeded data-api (see `chronicle-feeder/scripts/
 * inject-session.py`) and is skipped in CI.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
