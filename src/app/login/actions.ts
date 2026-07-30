"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import {
  clearLoginAttempts,
  consumeLoginAttempt,
} from "@/lib/login-rate-limit";

/** `email` is echoed back so a wrong password does not clear it too.
 * The password is never returned. */
export type LoginState = { error: string | null; email?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Introduz o teu email e palavra-passe.", email };
  }

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  const identifier = `${ip}:${email}`;
  const rateLimit = consumeLoginAttempt(identifier);
  if (!rateLimit.allowed) {
    return {
      error: "Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.",
      email,
    };
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email ou palavra-passe inválidos.", email };
  }

  clearLoginAttempts(identifier);
  await createSession(user.id);
  redirect("/dashboard");
}
