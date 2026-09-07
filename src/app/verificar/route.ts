import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeEmailToken } from "@/lib/email-tokens";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const consumed = await consumeEmailToken(db, token, "verify_email");
  if (!consumed) redirect("/login?verificado=0");
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, consumed.userId));
  redirect("/login?verificado=1");
}
