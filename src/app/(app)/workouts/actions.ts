"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  exercises,
  plannedWorkouts,
  sets,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { deleteOwnedRecord } from "@/lib/owned-resource";
import { buildWorkoutSetRows } from "@/lib/workout";
import { dateFromKey, isDateKey } from "@/lib/workout-calendar";

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

const plannedWorkoutSchema = z.object({
  date: z.string().refine(isDateKey),
  templateId: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
});

export type NewPlannedWorkoutInput = z.infer<typeof plannedWorkoutSchema>;

export async function createPlannedWorkout(input: NewPlannedWorkoutInput) {
  const user = await requireUser();
  const parsed = plannedWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Escolhe uma data válida para o plano." };
  }
  const { date, templateId, notes } = parsed.data;

  if (templateId != null) {
    const template = await db
      .select({ id: workoutTemplates.id })
      .from(workoutTemplates)
      .where(
        and(
          eq(workoutTemplates.id, templateId),
          eq(workoutTemplates.userId, user.id),
        ),
      )
      .get();
    if (!template) {
      return { error: "Esse modelo já não está disponível." };
    }
  }

  await db.insert(plannedWorkouts).values({
    userId: user.id,
    date: dateFromKey(date),
    templateId: templateId ?? null,
    notes: notes?.trim() || null,
  });

  revalidatePath("/workouts");
  return { success: true as const };
}

export async function deletePlannedWorkout(id: number) {
  const user = await requireUser();
  await deleteOwnedRecord({
    id,
    userId: user.id,
    findOwnedId: async (planId, userId) => {
      const plan = await db
        .select({ id: plannedWorkouts.id })
        .from(plannedWorkouts)
        .where(
          and(eq(plannedWorkouts.id, planId), eq(plannedWorkouts.userId, userId)),
        )
        .get();
      return plan?.id ?? null;
    },
    deleteOwned: async (planId, userId) => {
      await db
        .delete(plannedWorkouts)
        .where(
          and(eq(plannedWorkouts.id, planId), eq(plannedWorkouts.userId, userId)),
        );
    },
  });
  revalidatePath("/workouts");
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
