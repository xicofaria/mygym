"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { consumeEmailToken } from "@/lib/email-tokens";

export type ResetState = { error: string | null };

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(256),
});

export async function performReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: "A nova palavra-passe precisa de pelo menos 8 caracteres." };
  }
  const consumed = await consumeEmailToken(
    db,
    parsed.data.token,
    "password_reset",
  );
  if (!consumed) {
    return {
      error: "Este link expirou ou já foi usado. Pedir um novo link.",
    };
  }
  const updated = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      // Revokes every existing session of this account.
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(eq(users.id, consumed.userId))
    .returning({ id: users.id });
  if (!updated.length) {
    return { error: "Este link expirou ou já foi usado. Pedir um novo link." };
  }
  redirect("/login?ok=repor");
}
