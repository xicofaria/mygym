import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeEmailToken } from "@/lib/email-tokens";
import { TransactionRollback, ignoreRollback } from "@/lib/transaction";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") ?? "";
  const email = (params.get("email") ?? "").trim().toLowerCase();

  let verified = false;
  // Consumo do token e escrita do endereço na mesma transação: ou o link
  // confirma e aplica o email, ou não deixa rasto nenhum.
  await db
    .transaction(async (tx) => {
      const consumed = await consumeEmailToken(tx, token, "verify_email", email);
      if (!consumed) throw new TransactionRollback();
      // Consuming a token bound to `email` is the proof of control, so this is
      // also where a pending change from /conta lands: the address is applied
      // here, never before. For a registration token it equals the account's
      // current address and the write is a no-op.
      const claimed = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, consumed.userId)))
        .get();
      if (claimed) throw new TransactionRollback();
      const rows = await tx
        .update(users)
        .set({ email, emailVerifiedAt: new Date() })
        .where(eq(users.id, consumed.userId))
        .returning({ id: users.id });
      if (!rows.length) throw new TransactionRollback();
      verified = true;
    })
    .catch(ignoreRollback);
  redirect(`/login?verificado=${verified ? "1" : "0"}`);
}
