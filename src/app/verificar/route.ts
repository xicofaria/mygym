class TransactionRollback extends Error {}

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeEmailToken } from "@/lib/email-tokens";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") ?? "";
  const email = (params.get("email") ?? "").toLowerCase();

  let verified = false;
  // Consumo e atualização atómicos: se o email da conta mudou entretanto,
  // o link não verifica nada.
  await db
    .transaction(async (tx) => {
      const consumed = await consumeEmailToken(tx, token, "verify_email", email);
      if (!consumed) throw new TransactionRollback();
      const rows = await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(
          and(eq(users.id, consumed.userId), eq(users.email, email)),
        )
        .returning({ id: users.id });
      if (!rows.length) throw new TransactionRollback();
      verified = true;
    })
    .catch((error) => {
      if (!(error instanceof TransactionRollback)) throw error;
    });
  redirect(`/login?verificado=${verified ? "1" : "0"}`);
}
