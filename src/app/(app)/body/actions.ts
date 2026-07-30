"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bodyMetrics } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { deleteOwnedRecord } from "@/lib/owned-resource";
import {
  dateFromKey,
  isCurrentOrPastDateKey,
  isDateKey,
} from "@/lib/workout-calendar";

const schema = z.object({
  date: z.string().refine(isDateKey),
  weightKg: z.number().positive().max(500).optional(),
  heightCm: z.number().positive().max(300).optional(),
  waistCm: z.number().positive().max(300).optional(),
  chestCm: z.number().positive().max(300).optional(),
  armCm: z.number().positive().max(150).optional(),
  thighCm: z.number().positive().max(200).optional(),
  hipCm: z.number().positive().max(300).optional(),
  bodyFatPct: z.number().min(0).max(80).optional(),
  notes: z.string().max(500).optional(),
});

export type NewBodyMetricInput = z.infer<typeof schema>;

export async function createBodyMetric(input: NewBodyMetricInput) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Verifica os dados e tenta novamente." };
  const d = parsed.data;

  if (!isCurrentOrPastDateKey(d.date)) {
    return { error: "A medição não pode ter uma data futura ou inválida." };
  }

  const measurements = [
    d.weightKg,
    d.heightCm,
    d.waistCm,
    d.chestCm,
    d.armCm,
    d.thighCm,
    d.hipCm,
    d.bodyFatPct,
  ];
  if (!measurements.some((v) => v != null)) {
    return { error: "Introduz pelo menos uma medida." };
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
