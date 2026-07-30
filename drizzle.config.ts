import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next, so load env vars from .env.local ourselves.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall back to defaults / real environment vars
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso", // libSQL: works for both local file: URLs and Turso
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    // An explicit empty value lets isolated test processes clear an inherited
    // production token without making Drizzle treat it as a required credential.
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
});
