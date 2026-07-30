"use server";

import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { exercises, sets, workoutTemplateExercises } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  muscleGroup: z.string().trim().max(40).optional(),
});

const idSchema = z.number().int().positive();

function revalidateCatalog(id?: number) {
  revalidatePath("/exercises");
  if (id != null) revalidatePath(`/exercises/${id}`);
  revalidatePath("/workouts/new");
  revalidatePath("/workouts/templates");
  revalidatePath("/workouts");
}

/** How many sets and templates would be affected by removing an exercise. */
async function countExerciseUsage(exerciseId: number) {
  const [setRow, templateRow] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(sets)
      .where(eq(sets.exerciseId, exerciseId))
      .get(),
    db
      .select({ total: sql<number>`count(*)` })
      .from(workoutTemplateExercises)
      .where(eq(workoutTemplateExercises.exerciseId, exerciseId))
      .get(),
  ]);
  return {
    sets: Number(setRow?.total ?? 0),
    templates: Number(templateRow?.total ?? 0),
  };
}

export async function createExercise(input: unknown) {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Introduz um nome de exercício válido." };
  const { name, muscleGroup } = parsed.data;

  await db
    .insert(exercises)
    .values({ name, muscleGroup: muscleGroup || null })
    .onConflictDoNothing({ target: exercises.name });

  revalidateCatalog();
  return { error: null as string | null };
}

/**
 * Renames an exercise or changes its muscle group. The catalog is shared by
 * both users, so an edit is visible to both — but it never touches logged
 * sets, which reference the exercise by id.
 */
export async function updateExercise(id: unknown, input: unknown) {
  await requireUser();
  const parsedId = idSchema.safeParse(id);
  const parsed = schema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return { error: "Introduz um nome de exercício válido." };
  }
  const { name, muscleGroup } = parsed.data;
  const exerciseId = parsedId.data;

  const existing = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .get();
  if (!existing) return { error: "Esse exercício já não existe." };

  const clash = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.name, name), ne(exercises.id, exerciseId)))
    .get();
  if (clash) return { error: "Já existe um exercício com esse nome." };

  await db
    .update(exercises)
    .set({ name, muscleGroup: muscleGroup || null })
    .where(eq(exercises.id, exerciseId));

  revalidateCatalog(exerciseId);
  return { error: null as string | null };
}

/**
 * Removes an exercise from the shared catalog, but only while nothing points
 * at it: `sets.exercise_id` cascades on delete, so removing a used exercise
 * would silently erase logged sets — history both users may depend on.
 */
export async function deleteExercise(id: unknown) {
  await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Exercício inválido." };
  const exerciseId = parsedId.data;

  const usage = await countExerciseUsage(exerciseId);
  if (usage.sets > 0) {
    return {
      error:
        "Este exercício já tem séries registadas, por isso não pode ser eliminado sem apagar histórico. Podes mudar-lhe o nome.",
    };
  }
  if (usage.templates > 0) {
    return {
      error:
        "Este exercício faz parte de um modelo de treino. Remove-o do modelo primeiro.",
    };
  }

  await db.delete(exercises).where(eq(exercises.id, exerciseId));
  revalidateCatalog(exerciseId);
  redirect("/exercises");
}
