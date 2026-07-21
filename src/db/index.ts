import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Single libSQL/SQLite connection shared across the app.
 *
 * - Local dev: DATABASE_URL="file:./dev.db" (a plain SQLite file, no token).
 * - Production: DATABASE_URL="libsql://<db>.turso.io" plus DATABASE_AUTH_TOKEN.
 *
 * The same @libsql/client driver handles both, so no code changes between envs.
 */
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

export const db = drizzle(client, { schema });
export { schema };
