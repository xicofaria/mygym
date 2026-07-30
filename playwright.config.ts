import { defineConfig, devices } from "@playwright/test";

// Never inherit a developer or CI database URL here: setup and cleanup are
// destructive by design and must only ever target this disposable local file.
const databaseUrl = "file:./e2e.db";
const port = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PLAYWRIGHT_PORT tem de ser uma porta TCP válida.");
}
const baseURL = `http://127.0.0.1:${port}`;

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
    baseURL,
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
    // Production build, not `next dev`: the dev server compiles the client
    // bundle on demand, so hydration lags and a click can land on the
    // still-unhydrated form, which then submits natively instead of running
    // the server action.
    command:
      `npm run db:prepare:e2e && npm run db:migrate && npm run db:seed && npm run build && npm run start -- --port ${port}`,
    url: `${baseURL}/login`,
    // Reusing an arbitrary server can test the wrong build and database.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      DATABASE_AUTH_TOKEN: "",
      VERCEL: "",
      VERCEL_ENV: "",
      SESSION_SECRET:
        "e2e-only-session-secret-that-is-longer-than-32-characters",
      SEED_USER1_NAME: "E2E User",
      SEED_USER1_EMAIL: "e2e@example.com",
      SEED_USER1_PASSWORD: "e2e-password-123",
      SEED_USER2_NAME: "E2E Partner",
      SEED_USER2_EMAIL: "e2e-partner@example.com",
      SEED_USER2_PASSWORD: "e2e-partner-password-123",
    },
  },
});
