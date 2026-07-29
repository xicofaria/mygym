"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { exercises, sets, workouts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { deleteOwnedRecord } from "@/lib/owned-resource";
import { buildWorkoutSetRows } from "@/lib/workout";

const entrySchema = z.object({
  exerciseId: z.number().int().positive(),
  reps: z.number().int().min(1).max(1000),
  weight: z.number().min(0).max(2000),
});

const newWorkoutSchema = z.object({
  date: z.string().min(1),
  notes: z.string().max(1000).optional(),
  entries: z.array(entrySchema).min(1),
});

export type NewWorkoutInput = z.infer<typeof newWorkoutSchema>;

async function validateExercises(entries: NewWorkoutInput["entries"]) {
  const requestedIds = [...new Set(entries.map((entry) => entry.exerciseId))];
  const available = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(inArray(exercises.id, requestedIds))
    .all();

  return available.length === requestedIds.length;
}

function revalidateWorkoutPages() {
  revalidatePath("/dashboard");
  revalidatePath("/workouts");
  revalidatePath("/exercises");
}

export async function createWorkout(input: NewWorkoutInput) {
  const user = await requireUser();
  const parsed = newWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Adiciona pelo menos uma série com repetições e peso." };
  }
  const { date, notes, entries } = parsed.data;

  if (!(await validateExercises(entries))) {
    return { error: "Um dos exercícios selecionados já não está disponível." };
  }

  await db.transaction(async (tx) => {
    const workout = await tx
      .insert(workouts)
      .values({ userId: user.id, date: new Date(date), notes: notes || null })
      .returning({ id: workouts.id })
      .get();

    await tx
      .insert(sets)
      .values(buildWorkoutSetRows(workout.id, entries));
  });

  revalidateWorkoutPages();
  return { success: true as const };
}

export async function updateWorkout(id: number, input: NewWorkoutInput) {
  const user = await requireUser();
  const parsedId = z.number().int().positive().safeParse(id);
  const parsed = newWorkoutSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return { error: "Verifica as séries e tenta novamente." };
  }

  const ownedWorkout = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, parsedId.data), eq(workouts.userId, user.id)))
    .get();
  if (!ownedWorkout) {
    return { error: "Treino não encontrado." };
  }

  const { date, notes, entries } = parsed.data;
  if (!(await validateExercises(entries))) {
    return { error: "Um dos exercícios selecionados já não está disponível." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(workouts)
      .set({ date: new Date(date), notes: notes || null })
      .where(eq(workouts.id, ownedWorkout.id));
    await tx.delete(sets).where(eq(sets.workoutId, ownedWorkout.id));
    await tx
      .insert(sets)
      .values(buildWorkoutSetRows(ownedWorkout.id, entries));
  });

  revalidateWorkoutPages();
  return { success: true as const };
}

export async function deleteWorkout(id: number) {
  const user = await requireUser();
  await deleteOwnedRecord({
    id,
    userId: user.id,
    findOwnedId: async (workoutId, userId) => {
      const workout = await db
        .select({ id: workouts.id })
        .from(workouts)
        .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
        .get();
      return workout?.id ?? null;
    },
    deleteOwned: async (workoutId, userId) => {
      await db
        .delete(workouts)
        .where(
          and(eq(workouts.id, workoutId), eq(workouts.userId, userId)),
        );
    },
  });
  revalidateWorkoutPages();
}
