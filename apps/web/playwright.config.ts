import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against the production build in a real browser at two sizes.
 * `npm run e2e` builds, serves and tests; nothing here talks to the internet.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure", reducedMotion: "no-preference" },
  webServer: [
    {
      // The main build: the assistant answers on the device.
      command: "npm run build && node scripts/serve.mjs --port 4173",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // A second build whose assistant calls the site's own proxy, with a stand-in for the AI model (no key, no network).
      command: "npx vite build --outDir dist-remote --emptyOutDir && node scripts/serve.mjs --dir dist-remote --port 4174",
      env: { VITE_ASSISTANT_PROVIDER: "remote", ASSISTANT_FAKE_MODEL: "1", RATE_LIMIT_PER_MINUTE: "200" },
      url: "http://localhost:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // A third build that also offers the draft tax year (2025/26), for the year-selector tests. Production builds offer
      // only signed-off years, so this one exists only for testing and is never deployed (docs/DEPLOY.md).
      command: "npx vite build --outDir dist-years --emptyOutDir && node scripts/serve.mjs --dir dist-years --port 4175",
      env: { VITE_ENABLE_DRAFT_YEARS: "1" },
      url: "http://localhost:4175",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 360, height: 780 }, hasTouch: true } },
  ],
});
