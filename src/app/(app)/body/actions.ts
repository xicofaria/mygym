"use server";

import { bodyMetricInputSchema } from "@/lib/body-metric-input";
import type { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bodyMetrics } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { deleteOwnedRecord } from "@/lib/owned-resource";
import { dateFromKey, isCurrentOrPastDateKey } from "@/lib/workout-calendar";

export type NewBodyMetricInput = z.infer<typeof bodyMetricInputSchema>;

export async function createBodyMetric(input: unknown) {
  const user = await requireUser();
  const parsed = bodyMetricInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Verifica os dados e tenta novamente." };
  const d = parsed.data;

  if (!isCurrentOrPastDateKey(d.date)) {
    return { error: "A medição não pode ter uma data futura ou inválida." };
  }

  await db.insert(bodyMetrics).values({
    userId: user.id,
    date: dateFromKey(d.date),
    weightKg: d.weightKg ?? null,
    heightCm: d.heightCm ?? null,
    waistCm: d.waistCm ?? null,
    chestCm: d.chestCm ?? null,
    armCm: d.armCm ?? null,
    thighCm: d.thighCm ?? null,
    hipCm: d.hipCm ?? null,
    bodyFatPct: d.bodyFatPct ?? null,
    notes: d.notes || null,
  });

  revalidatePath("/dashboard");
  revalidatePath("/body");
  return { error: null as string | null };
}

export async function deleteBodyMetric(id: number) {
  const user = await requireUser();
  await deleteOwnedRecord({
    id,
    userId: user.id,
    findOwnedId: async (metricId, userId) => {
      const metric = await db
        .select({ id: bodyMetrics.id })
        .from(bodyMetrics)
        .where(
          and(eq(bodyMetrics.id, metricId), eq(bodyMetrics.userId, userId)),
        )
        .get();
      return metric?.id ?? null;
    },
    deleteOwned: async (metricId, userId) => {
      await db
        .delete(bodyMetrics)
        .where(
          and(eq(bodyMetrics.id, metricId), eq(bodyMetrics.userId, userId)),
        );
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/body");
}
