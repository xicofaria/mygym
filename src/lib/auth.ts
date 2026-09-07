import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getSessionSecret } from "./env";
import { isEmailConfigured } from "./email";

/**
 * Lightweight cookie-session auth.
 *
 * We deliberately avoid a full auth framework (NextAuth/Auth.js) because it does
 * not yet track Next 16 cleanly. A signed JWT in an httpOnly cookie carries the
 * user id plus the account's tokenVersion: bumping tokenVersion (password
 * change, email change, account deletion) instantly invalidates every issued
 * session. Per the Next docs, auth is enforced in server components (via
 * requireUser) and inside every server action — NOT in proxy.ts.
 */

const COOKIE = "gym_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

const secret = new TextEncoder().encode(getSessionSecret());

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(
  userId: number,
  tokenVersion: number,
): Promise<void> {
  const token = await new SignJWT({ userId, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

async function getSessionPayload(): Promise<{ userId: number; tv: number } | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== "number") return null;
    return { userId: payload.userId, tv: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSessionPayload();
  if (!session) return null;
  const row = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();
  if (!row || row.tokenVersion !== session.tv) return null;
  // With a transactional email provider configured, unverified accounts never
  // hold a usable session (defense in depth on top of the login/register gates).
  if (isEmailConfigured() && !row.emailVerifiedAt) return null;
  return row;
}

/** Use at the top of every protected server component / server action. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
