import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { aiUsage } from "../db/schema";

/** Reserve before calling a provider; failures also consume a slot to bound cost. */
export async function reserveAIQuota<TSchema extends Record<string, unknown>>(
  database: LibSQLDatabase<TSchema>,
  userId: number,
  day: string,
  limit: number,
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(userId) ||
    userId < 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day)
  ) {
    throw new Error("Quota inválida.");
  }
  const rows = await database
    .insert(aiUsage)
    .values({ userId, day, attempts: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { attempts: sql`${aiUsage.attempts} + 1` },
      setWhere: sql`${aiUsage.attempts} < ${limit}`,
    })
    .returning({ attempts: aiUsage.attempts });
  return rows.length === 1;
}
