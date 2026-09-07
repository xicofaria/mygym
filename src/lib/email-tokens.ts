import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { emailTokens } from "@/db/schema";

export const TOKEN_PURPOSES = ["verify_email", "password_reset"] as const;
export type EmailTokenPurpose = (typeof TOKEN_PURPOSES)[number];

const TOKEN_TTL: Record<EmailTokenPurpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

const hashToken = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

/** Returns the raw one-time token; only its SHA-256 hash is stored. The token
 * is bound to the concrete email it was sent to. */
export async function createEmailToken<
  TSchema extends Record<string, unknown>,
>(
  database: LibSQLDatabase<TSchema>,
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
  database: LibSQLDatabase<TSchema>,
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
>(database: LibSQLDatabase<TSchema>, userId: number): Promise<void> {
  await database.delete(emailTokens).where(eq(emailTokens.userId, userId));
}
