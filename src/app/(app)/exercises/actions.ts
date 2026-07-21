"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  muscleGroup: z.string().trim().max(40).optional(),
});

export async function createExercise(input: unknown) {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Introduz um nome de exercício válido." };
  const { name, muscleGroup } = parsed.data;

  await db
    .insert(exercises)
    .values({ name, muscleGroup: muscleGroup || null })
    .onConflictDoNothing({ target: exercises.name });

  revalidatePath("/exercises");
  revalidatePath("/workouts/new");
  return { error: null as string | null };
}
