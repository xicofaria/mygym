"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { exercises, exerciseFavorites } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { exerciseInputSchema } from "@/lib/exercise-catalog";

export async function createExercise(input: unknown) {
  await requireUser();
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Introduz um nome de exercício válido." };
  const { name, muscleGroup, aliases, equipment } = parsed.data;

  const inserted = await db
    .insert(exercises)
    .values({
      name,
      muscleGroup: muscleGroup || null,
      aliases: aliases ?? "",
      equipment: equipment ?? "",
    })
    .onConflictDoNothing({ target: exercises.name })
    .returning({ id: exercises.id });
  if (!inserted.length)
    return { error: "Já existe um exercício com esse nome." };

  revalidatePath("/exercises");
  revalidatePath("/workouts/new");
  return { error: null as string | null, id: inserted[0].id };
}

/** Catalogue is shared; edits never change exercise IDs or existing sets. */
export async function updateExercise(id: unknown, input: unknown) {
  await requireUser();
  const parsedId = z.number().int().positive().safeParse(id);
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsedId.success || !parsed.success)
    return { error: "Verifica os dados do exercício." };
  const { name, muscleGroup, aliases, equipment } = parsed.data;
  // A transaction makes the duplicate check and update one write unit.
  const result = await db.transaction(async (tx) => {
    const duplicate = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.name, name))
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
      .where(eq(exercises.id, parsedId.data))
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
    .where(eq(exercises.id, exerciseId))
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
