import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { buildWeeklyReportEmail } from "@/lib/weekly-report-email";
import { isEmailConfigured, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
// One report per opted-in account, each a handful of queries plus a Resend call
// with a 10 s timeout. The default budget truncates the loop silently, mailing
// the first accounts and nobody after them, with no retry and no record.
export const maxDuration = 300;

/** Vercel cron target (Mondays 08:00 UTC). Authorization: Bearer $CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json(
      { error: "Não autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isEmailConfigured()) {
    return Response.json(
      { ok: true, skipped: "envio de email não configurado" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const recipients = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(
      and(
        eq(users.weeklyReportEnabled, true),
        isNotNull(users.emailVerifiedAt),
      ),
    )
    .all();

  let sent = 0;
  for (const recipient of recipients) {
    try {
      const message = await buildWeeklyReportEmail(recipient.id, recipient.name);
      if (!message) continue;
      const delivered = await sendEmail({
        to: recipient.email,
        ...message,
      });
      if (delivered) sent += 1;
    } catch {
      // Um destinatário com falha nunca impede os restantes.
    }
  }
  return Response.json(
    { ok: true, sent },
    { headers: { "Cache-Control": "no-store" } },
  );
}
