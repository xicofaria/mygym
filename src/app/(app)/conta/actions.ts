"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { createEmailToken } from "@/lib/email-tokens";
import {
  accountDeletedEmail,
  isEmailConfigured,
  sendEmail,
  verificationEmail,
} from "@/lib/email";

export type AccountState = { error: string | null; ok?: string };

export async function updateName(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const name = z
    .string()
    .trim()
    .min(1)
    .max(80)
    .safeParse(String(formData.get("name") ?? ""));
  if (!name.success) {
    return { error: "Introduz um nome válido." };
  }
  await db.update(users).set({ name: name.data }).where(eq(users.id, user.id));
  return { error: null, ok: "Nome atualizado." };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
  });
  if (!parsed.success) {
    return {
      error:
        "A nova palavra-passe precisa de pelo menos 8 caracteres; indica também a atual.",
    };
  }
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "A palavra-passe atual está incorreta." };
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  const nextVersion = user.tokenVersion + 1;
  await db
    .update(users)
    .set({ passwordHash, tokenVersion: nextVersion })
    .where(eq(users.id, user.id));
  // Keep this device signed in with the bumped version; every other session dies.
  await createSession(user.id, nextVersion);
  return {
    error: null,
    ok: "Palavra-passe alterada. As outras sessões foram terminadas.",
  };
}

export async function changeEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const parsed = z
    .object({
      newEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)),
      password: z.string().min(1).max(256),
    })
    .safeParse({
      newEmail: String(formData.get("newEmail") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  if (!parsed.success) {
    return { error: "Introduz um email válido e a tua palavra-passe." };
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "A palavra-passe está incorreta." };
  }
  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.newEmail))
    .get();
  if (taken) {
    return { error: "Já existe uma conta com esse email." };
  }
  const nextVersion = user.tokenVersion + 1;
  const updated = await db
    .update(users)
    .set({
      email: parsed.data.newEmail,
      emailVerifiedAt: null,
      tokenVersion: nextVersion,
    })
    .where(eq(users.id, user.id))
    .returning({ tokenVersion: users.tokenVersion });
  await createSession(user.id, updated[0]?.tokenVersion ?? nextVersion);
  if (isEmailConfigured()) {
    const token = await createEmailToken(db, user.id, "verify_email");
    const message = verificationEmail(token);
    await sendEmail({ to: parsed.data.newEmail, ...message });
  }
  return {
    error: null,
    ok: isEmailConfigured()
      ? "Email atualizado. Confirma o novo endereço no teu email."
      : "Email atualizado.",
  };
}

const DELETE_WORD = "ELIMINAR";

export async function deleteAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const confirm = String(formData.get("confirm") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (confirm !== DELETE_WORD) {
    return { error: "Escreve ELIMINAR para confirmar." };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: "A palavra-passe está incorreta." };
  }
  await destroySession();
  // All user-owned rows cascade (workouts, sets, plans, favourites, AI usage,
  // body metrics, products including their photos, entries, goals and days).
  await db.delete(users).where(eq(users.id, user.id));
  if (isEmailConfigured()) {
    const message = accountDeletedEmail();
    await sendEmail({ to: user.email, ...message });
  }
  redirect("/login?eliminada=1");
}
