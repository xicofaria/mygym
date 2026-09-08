"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { exercises, exerciseFavorites } from "@/db/schema";
import { visibleExercises } from "@/lib/exercise-access";
import { requireUser } from "@/lib/auth";
import { exerciseInputSchema } from "@/lib/exercise-catalog";

export async function createExercise(input: unknown) {
  const user = await requireUser();
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Introduz um nome de exercício válido." };
  const { name, muscleGroup, aliases, equipment } = parsed.data;

  const inserted = await db.transaction(async (tx) => {
    const duplicate = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.name, name), visibleExercises(user.id)))
      .get();
    if (duplicate) return null;
    const [exercise] = await tx
      .insert(exercises)
      .values({
        userId: user.id,
        name,
        muscleGroup: muscleGroup || null,
        aliases: aliases ?? "",
        equipment: equipment ?? "",
      })
      .onConflictDoNothing()
      .returning({ id: exercises.id });
    return exercise ?? null;
  });
  if (!inserted)
    return { error: "Já existe um exercício com esse nome no teu catálogo." };

  revalidatePath("/exercises");
  revalidatePath("/workouts/new");
  return { error: null as string | null, id: inserted.id };
}

/** Only the owner may edit a private exercise; common exercises are read-only. */
export async function updateExercise(id: unknown, input: unknown) {
  const user = await requireUser();
  const parsedId = z.number().int().positive().safeParse(id);
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsedId.success || !parsed.success)
    return { error: "Verifica os dados do exercício." };
  const { name, muscleGroup, aliases, equipment } = parsed.data;
  // A transaction makes the duplicate check and update one write unit.
  const result = await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(
        and(eq(exercises.id, parsedId.data), eq(exercises.userId, user.id)),
      )
      .get();
    if (!owned)
      return { error: "Só podes editar os teus exercícios privados." };
    const duplicate = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.name, name), visibleExercises(user.id)))
      .get();
    if (duplicate && duplicate.id !== parsedId.data)
      return { error: "Já existe um exercício com esse nome." };
    const updated = await tx
      .update(exercises)
      .set({
        name,
        muscleGroup: muscleGroup || null,
        aliases: aliases ?? "",
        equipment: equipment ?? "",
      })
      .where(
        and(eq(exercises.id, parsedId.data), eq(exercises.userId, user.id)),
      )
      .returning({ id: exercises.id });
    return { error: updated.length ? null : "Exercício não encontrado." };
  });
  revalidatePath("/", "layout");
  return result;
}

export async function setExerciseFavorite(input: unknown) {
  const user = await requireUser();
  const parsed = z
    .object({ exerciseId: z.number().int().positive(), favorite: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { error: "Exercício inválido." };
  const { exerciseId, favorite } = parsed.data;
  const exists = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), visibleExercises(user.id)))
    .get();
  if (!exists) return { error: "Exercício não encontrado." };
  if (favorite) {
    await db
      .insert(exerciseFavorites)
      .values({ userId: user.id, exerciseId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(exerciseFavorites)
      .where(
        and(
          eq(exerciseFavorites.userId, user.id),
          eq(exerciseFavorites.exerciseId, exerciseId),
        ),
      );
  }
  revalidatePath("/exercises");
  revalidatePath("/workouts/new");
  return { error: null };
}
