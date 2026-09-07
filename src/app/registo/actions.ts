"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { consumeLoginAttempt } from "@/lib/login-rate-limit";
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

/**
 * Registration is capped per IP alone, in its own namespace.
 *
 * Keying it by `ip:email` like the login limiter capped nothing — a script just
 * varies the address to get a fresh bucket every time, and each attempt still
 * costs a bcrypt hash, a row, and (with a provider) an outbound mail to any
 * address it likes. The separate namespace also stops a burst of duplicate-email
 * attempts from burning the *login* bucket of the account being guessed at.
 */
async function registrationIdentifier() {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  return `registo:${ip}`;
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

  const rateLimit = consumeLoginAttempt(await registrationIdentifier());
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
    .returning({ id: users.id, tokenVersion: users.tokenVersion });
  const created = inserted[0];
  if (!created) {
    return {
      error: "Não foi possível criar a conta. Tenta novamente.",
      name: parsed.data.name,
      email,
    };
  }

  // A successful signup still counts towards the per-IP cap: clearing it here
  // would let one script alternate successes to keep the bucket permanently open.
  if (isEmailConfigured()) {
    // Com email ativo, a conta só entra após confirmação do endereço
    // (verificação obrigatória antes do primeiro login).
    const token = await createEmailToken(db, created.id, "verify_email", email);
    const message = verificationEmail(token, email);
    const delivered = await sendEmail({ to: email, ...message });
    // Either way the account exists; a failed send is recoverable because the
    // next sign-in attempt mints and sends a fresh link.
    redirect(`/login?verificar=${delivered ? "1" : "0"}`);
  }

  await createSession(created.id, created.tokenVersion);
  redirect("/dashboard");
}
