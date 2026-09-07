import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeEmailToken } from "@/lib/email-tokens";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") ?? "";
  const email = (params.get("email") ?? "").toLowerCase();
  const consumed = await consumeEmailToken(db, token, "verify_email", email);
  if (!consumed) redirect("/login?verificado=0");
  // Só marca verificado se o token for do endereço atual da conta.
  const updated = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, consumed.userId))
    .returning({ id: users.id });
  redirect(`/login?verificado=${updated.length ? "1" : "0"}`);
}
