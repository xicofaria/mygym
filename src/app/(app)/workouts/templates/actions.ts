"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  exercises,
  workoutTemplateExercises,
  workoutTemplates,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { deleteOwnedRecord } from "@/lib/owned-resource";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  exerciseIds: z.array(z.number().int().positive()).min(1).max(100),
});

export type NewTemplateInput = z.infer<typeof schema>;

export async function createTemplate(input: NewTemplateInput) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: "Dá um nome ao modelo e escolhe pelo menos um exercício." };
  }
  const { name, exerciseIds } = parsed.data;

  const requestedIds = [...new Set(exerciseIds)];
  const available = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(inArray(exercises.id, requestedIds))
    .all();
  if (available.length !== requestedIds.length) {
    return { error: "Um dos exercícios selecionados já não está disponível." };
  }

  await db.transaction(async (tx) => {
    const template = await tx
      .insert(workoutTemplates)
      .values({ userId: user.id, name })
      .returning({ id: workoutTemplates.id })
      .get();

    await tx.insert(workoutTemplateExercises).values(
      requestedIds.map((exerciseId, position) => ({
        templateId: template.id,
        exerciseId,
        position,
      })),
    );
  });

  revalidatePath("/workouts/templates");
  revalidatePath("/workouts/new");
  redirect("/workouts/templates");
}

export async function deleteTemplate(id: number) {
  const user = await requireUser();
  await deleteOwnedRecord({
    id,
    userId: user.id,
    findOwnedId: async (templateId, userId) => {
      const template = await db
        .select({ id: workoutTemplates.id })
        .from(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.id, templateId),
            eq(workoutTemplates.userId, userId),
          ),
        )
        .get();
      return template?.id ?? null;
    },
    deleteOwned: async (templateId, userId) => {
      await db
        .delete(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.id, templateId),
            eq(workoutTemplates.userId, userId),
          ),
        );
    },
  });
  revalidatePath("/workouts/templates");
  revalidatePath("/workouts/new");
}
