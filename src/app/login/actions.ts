"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import {
  clearLoginAttempts,
  consumeLoginAttempt,
} from "@/lib/login-rate-limit";
import { isEmailConfigured, sendEmail, verificationEmail } from "@/lib/email";
import { createEmailToken, revokeEmailTokens } from "@/lib/email-tokens";


/** `email` is echoed back so a wrong password does not clear it too.
 * The password is never returned. */
export type LoginState = { error: string | null; email?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(256),
});

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "");
  const rawPassword = String(formData.get("password") ?? "");
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parsed.success) {
    const email = rawEmail.trim().slice(0, 254);
    return {
      error:
        !email || !rawPassword
          ? "Introduz o teu email e palavra-passe."
          : "Email ou palavra-passe inválidos.",
      email,
    };
  }
  const { email, password } = parsed.data;

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
  // Dormant until a transactional email provider is configured on the server.
  // Existing accounts migrate on first login: we send the verification link.
  if (isEmailConfigured() && !user.emailVerifiedAt) {
    // Replace rather than accumulate: every attempt otherwise mints another row
    // and another outbound mail, with only the per-instance limiter in the way.
    const token = await db.transaction(async (tx) => {
      await revokeEmailTokens(tx, user.id);
      return createEmailToken(tx, user.id, "verify_email", email);
    });
    const message = verificationEmail(token, email);
    const delivered = await sendEmail({ to: email, ...message });
    return {
      error: delivered
        ? "Enviámos um link de confirmação para este email. Confirma-o para entrares."
        : "Não conseguimos enviar o email de confirmação. Tenta novamente dentro de alguns minutos.",
      email,
    };
  }

  clearLoginAttempts(identifier);
  await createSession(user.id, user.tokenVersion);
  redirect("/dashboard");
}
