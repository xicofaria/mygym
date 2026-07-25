const DEVELOPMENT_SESSION_SECRET = "dev-insecure-secret-change-me";

export function getSessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!value || value === DEVELOPMENT_SESSION_SECRET || value.length < 32) {
      throw new Error(
        "SESSION_SECRET must be set to a unique value of at least 32 characters in production.",
      );
    }
  }
  return value ?? DEVELOPMENT_SESSION_SECRET;
}

export function getDatabaseConfig(): {
  url: string;
  authToken?: string;
} {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (process.env.NODE_ENV === "production" && !url) {
    throw new Error("DATABASE_URL must be set in production.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    url?.startsWith("libsql://") &&
    !authToken
  ) {
    throw new Error(
      "DATABASE_AUTH_TOKEN must be set for a production libSQL database.",
    );
  }

  return { url: url ?? "file:./dev.db", authToken };
}
