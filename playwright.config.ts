import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./e2e.db",
      SESSION_SECRET:
        process.env.SESSION_SECRET ??
        "e2e-only-session-secret-that-is-longer-than-32-characters",
      SEED_USER1_NAME: process.env.SEED_USER1_NAME ?? "E2E User",
      SEED_USER1_EMAIL: process.env.SEED_USER1_EMAIL ?? "e2e@example.com",
      SEED_USER1_PASSWORD:
        process.env.SEED_USER1_PASSWORD ?? "e2e-password-123",
      SEED_USER2_NAME: process.env.SEED_USER2_NAME ?? "E2E Partner",
      SEED_USER2_EMAIL:
        process.env.SEED_USER2_EMAIL ?? "e2e-partner@example.com",
      SEED_USER2_PASSWORD:
        process.env.SEED_USER2_PASSWORD ?? "e2e-partner-password-123",
    },
  },
});
