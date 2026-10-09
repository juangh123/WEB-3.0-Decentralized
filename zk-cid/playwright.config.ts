import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // Use the local Next binary directly so the config does not depend on a globally
      // available `yarn`/corepack shim inside the Playwright-spawned shell.
      // Serve the production build (CI runs `yarn next:build` before the E2E step):
      // `next dev` recompiles pages on demand and makes smoke tests slow and flaky.
      command: "node node_modules/next/dist/bin/next start",
      cwd: "./packages/nextjs",
      port: 3000,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
