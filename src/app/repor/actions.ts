"use server";

import { and, eq, sql } from "drizzle-orm";
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

class TransactionRollback extends Error {}

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
  const invalid: ResetState = {
    error: "Este link expirou ou já foi usado. Pedir um novo link.",
  };

  let outcome = invalid;
  // Consumo do token e atualização da conta na mesma transação, validando o
  // estado atual: se o email da conta mudou entretanto, o link morre.
  await db
    .transaction(async (tx) => {
      const consumed = await consumeEmailToken(
        tx,
        parsed.data.token,
        "password_reset",
        parsed.data.email,
      );
      if (!consumed) throw new TransactionRollback();
      const passwordHash = await hashPassword(parsed.data.password);
      const rows = await tx
        .update(users)
        .set({
          passwordHash,
          emailVerifiedAt: new Date(),
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(
          and(
            eq(users.id, consumed.userId),
            eq(users.email, parsed.data.email),
          ),
        )
        .returning({ id: users.id });
      if (!rows.length) throw new TransactionRollback();
      await revokeEmailTokens(tx, consumed.userId);
      outcome = { error: null };
    })
    .catch((error) => {
      if (!(error instanceof TransactionRollback)) throw error;
    });

  if (outcome.error) return outcome;
  redirect("/login?ok=repor");
}
