"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createEmailToken } from "@/lib/email-tokens";
import { isEmailConfigured, resetEmail, sendEmail } from "@/lib/email";
import { consumeLoginAttempt } from "@/lib/login-rate-limit";

export type RecoverState = {
  error: string | null;
  notice: string | null;
  unavailable: boolean;
};

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export async function requestReset(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  if (!isEmailConfigured()) {
    return {
      error:
        "A recuperação por email está indisponível: o servidor não tem envio de email configurado.",
      notice: null,
      unavailable: true,
    };
  }
  const email = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!email.success) {
    return { error: "Introduz um email válido.", notice: null, unavailable: false };
  }
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  if (!consumeLoginAttempt(`${ip}:${email.data}`)) {
    return {
      error: "Demasiadas tentativas. Aguarda alguns minutos.",
      notice: null,
      unavailable: false,
    };
  }
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.data))
    .get();
  if (user) {
    const token = await createEmailToken(db, user.id, "password_reset");
    const message = resetEmail(token);
    await sendEmail({ to: email.data, ...message });
  }
  redirect("/recuperar?enviado=1");
}
