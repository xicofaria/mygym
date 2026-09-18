import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bodyMetrics } from "@/db/schema";

export async function getBodyMetrics(userId: number) {
  return db
    .select()
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.date), desc(bodyMetrics.id))
    .all();
}

