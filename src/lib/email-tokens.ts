import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { ResultSet } from "@libsql/client";
import { emailTokens } from "@/db/schema";

/** The plain database or an open transaction (consumo e atualização atómicos). */
export type EmailTokenDatabase<TSchema extends Record<string, unknown>> =
  | LibSQLDatabase<TSchema>
  | SQLiteTransaction<"async", ResultSet, TSchema, ExtractTablesWithRelations<TSchema>>;

export const TOKEN_PURPOSES = ["verify_email", "password_reset"] as const;
export type EmailTokenPurpose = (typeof TOKEN_PURPOSES)[number];

const TOKEN_TTL: Record<EmailTokenPurpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

/**
 * SHA-256 is the right primitive here and deliberately NOT bcrypt/scrypt.
 *
 * `raw` is never a user secret: it is 32 bytes straight from the CSPRNG in
 * `createEmailToken`, so there is no low-entropy guess to slow an attacker
 * down to — the 256 bits already make offline search infeasible. A password
 * hash would also break the lookup outright, because bcrypt/scrypt salt every
 * digest and tokens are found *by* their hash (`eq(emailTokens.tokenHash, …)`).
 *
 * Real passwords go through bcrypt in `src/lib/auth.ts`. CodeQL's
 * `js/insufficient-password-hash` heuristic reads the `"password_reset"`
 * purpose literal as a password reaching this call; see the note in
 * docs/VALIDATION.md.
 */
const hashToken = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

/** Returns the raw one-time token; only its SHA-256 hash is stored. The token
 * is bound to the concrete email it was sent to. */
export async function createEmailToken<
  TSchema extends Record<string, unknown>,
>(
  database: EmailTokenDatabase<TSchema>,
  userId: number,
  purpose: EmailTokenPurpose,
  email: string,
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await database.insert(emailTokens).values({
    userId,
    purpose,
    email,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]),
  });
  return raw;
}

/** Consumes a valid, unused, unexpired token bound to `email` and returns its
 * owner. */
export async function consumeEmailToken<
  TSchema extends Record<string, unknown>,
>(
  database: EmailTokenDatabase<TSchema>,
  raw: string,
  purpose: EmailTokenPurpose,
  email: string,
): Promise<{ userId: number } | null> {
  if (!raw || !email) return null;
  const tokenHash = hashToken(raw);
  const now = new Date();
  const updated = await database
    .update(emailTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailTokens.tokenHash, tokenHash),
        eq(emailTokens.purpose, purpose),
        eq(emailTokens.email, email),
        isNull(emailTokens.usedAt),
      ),
    )
    .returning({ userId: emailTokens.userId, expiresAt: emailTokens.expiresAt });
  const token = updated[0];
  if (!token || token.expiresAt.getTime() < now.getTime()) return null;
  return { userId: token.userId };
}

/** Drops every outstanding token of an account (credential changes). */
export async function revokeEmailTokens<
  TSchema extends Record<string, unknown>,
>(database: EmailTokenDatabase<TSchema>, userId: number): Promise<void> {
  await database.delete(emailTokens).where(eq(emailTokens.userId, userId));
}
