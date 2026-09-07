"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { consumeEmailToken, revokeEmailTokens } from "@/lib/email-tokens";

export type ResetState = { error: string | null };

const schema = z.object({
  token: z.string().min(10).max(200),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(256),
});

export async function performReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse({
    token: String(formData.get("token") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: "A nova palavra-passe precisa de pelo menos 8 caracteres." };
  }
  const consumed = await consumeEmailToken(
    db,
    parsed.data.token,
    "password_reset",
    parsed.data.email,
  );
  if (!consumed) {
    return { error: "Este link expirou ou já foi usado. Pedir um novo link." };
  }
  // O link prova a posse do email: confirma a verificação e revoga tokens
  // pendentes. A versão de sessão incrementa atomicamente (revoga as demais).
  const passwordHash = await hashPassword(parsed.data.password);
  const updated = await db
    .update(users)
    .set({
      passwordHash,
      emailVerifiedAt: new Date(),
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(eq(users.id, consumed.userId))
    .returning({ id: users.id });
  if (!updated.length) {
    return { error: "Este link expirou ou já foi usado. Pedir um novo link." };
  }
  await revokeEmailTokens(db, consumed.userId);
  redirect("/login?ok=repor");
}
