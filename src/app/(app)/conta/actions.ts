"use server";

import { and, eq, sql } from "drizzle-orm";
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
import { createEmailToken, revokeEmailTokens } from "@/lib/email-tokens";
import {
  accountDeletedEmail,
  isEmailConfigured,
  sendEmail,
  verificationEmail,
} from "@/lib/email";

export type AccountState = { error: string | null; ok?: string };

const STALE =
  "A conta foi alterada entretanto. Recarrega a página e tenta novamente.";

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
  // Incremento atómico + optimistic lock: se a conta mudou entretanto, a
  // alteração é rejeitada em vez de deixar sessões por revogar.
  const updated = await db
    .update(users)
    .set({
      passwordHash,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(
      and(eq(users.id, user.id), eq(users.tokenVersion, user.tokenVersion)),
    )
    .returning({ tokenVersion: users.tokenVersion });
  if (!updated.length) return { error: STALE };
  await revokeEmailTokens(db, user.id);
  // Keep this device signed in with the bumped version; every other session dies.
  await createSession(user.id, updated[0].tokenVersion);
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
  const updated = await db
    .update(users)
    .set({
      email: parsed.data.newEmail,
      emailVerifiedAt: null,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(
      and(eq(users.id, user.id), eq(users.tokenVersion, user.tokenVersion)),
    )
    .returning({ tokenVersion: users.tokenVersion });
  if (!updated.length) return { error: STALE };
  await revokeEmailTokens(db, user.id);
  await createSession(user.id, updated[0].tokenVersion);
  if (isEmailConfigured()) {
    const token = await createEmailToken(
      db,
      user.id,
      "verify_email",
      parsed.data.newEmail,
    );
    const message = verificationEmail(token, parsed.data.newEmail);
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
