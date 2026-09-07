"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import {
  clearLoginAttempts,
  consumeLoginAttempt,
} from "@/lib/login-rate-limit";
import { createEmailToken } from "@/lib/email-tokens";
import { isEmailConfigured, sendEmail, verificationEmail } from "@/lib/email";

export type RegisterState = {
  error: string | null;
  name?: string;
  email?: string;
};

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(256),
});

async function requestIdentifier(email: string) {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  return `${ip}:${email}`;
}

export async function register(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "");
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const parsed = registerSchema.safeParse({
    name,
    email: rawEmail,
    password,
  });
  if (!parsed.success) {
    return {
      error: !name.trim()
        ? "Introduz o teu nome."
        : password.length < 8
          ? "A palavra-passe precisa de pelo menos 8 caracteres."
          : "Introduz um email válido.",
      name: name.slice(0, 80),
      email: rawEmail.trim().slice(0, 254),
    };
  }
  const { email } = parsed.data;

  const rateLimit = consumeLoginAttempt(await requestIdentifier(email));
  if (!rateLimit.allowed) {
    return {
      error: "Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.",
      name: parsed.data.name,
      email,
    };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    return {
      error: "Já existe uma conta com este email. Inicia sessão.",
      name: parsed.data.name,
      email,
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const inserted = await db
    .insert(users)
    .values({ name: parsed.data.name, email, passwordHash })
    .returning({ id: users.id });
  const created = inserted[0];
  if (!created) {
    return {
      error: "Não foi possível criar a conta. Tenta novamente.",
      name: parsed.data.name,
      email,
    };
  }

  if (isEmailConfigured()) {
    // Com email ativo, a conta só entra após confirmação do endereço
    // (verificação obrigatória antes do primeiro login).
    const token = await createEmailToken(db, created.id, "verify_email", email);
    const message = verificationEmail(token, email);
    await sendEmail({ to: email, ...message });
    clearLoginAttempts(await requestIdentifier(email));
    redirect("/login?verificar=1");
  }

  clearLoginAttempts(await requestIdentifier(email));
  await createSession(created.id, 0);
  redirect("/dashboard");
}
