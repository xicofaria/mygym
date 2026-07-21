"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { workoutTemplateExercises, workoutTemplates } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  exerciseIds: z.array(z.number().int().positive()).min(1),
});

export type NewTemplateInput = z.infer<typeof schema>;

export async function createTemplate(input: NewTemplateInput) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: "Dá um nome ao modelo e escolhe pelo menos um exercício." };
  }
  const { name, exerciseIds } = parsed.data;

  const template = await db
    .insert(workoutTemplates)
    .values({ userId: user.id, name })
    .returning({ id: workoutTemplates.id })
    .get();

  await db.insert(workoutTemplateExercises).values(
    exerciseIds.map((exerciseId, position) => ({
      templateId: template.id,
      exerciseId,
      position,
    })),
  );

  revalidatePath("/workouts/templates");
  revalidatePath("/workouts/new");
  redirect("/workouts/templates");
}

export async function deleteTemplate(id: number) {
  const user = await requireUser();
  await db
    .delete(workoutTemplates)
    .where(
      and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id)),
    );
  revalidatePath("/workouts/templates");
  revalidatePath("/workouts/new");
}
