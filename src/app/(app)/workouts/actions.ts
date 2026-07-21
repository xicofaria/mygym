"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sets, workouts } from "@/db/schema";
import { requireUser } from "@/lib/auth";

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

export async function createWorkout(input: NewWorkoutInput) {
  const user = await requireUser();
  const parsed = newWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Adiciona pelo menos uma série com repetições e peso." };
  }
  const { date, notes, entries } = parsed.data;

  const workout = await db
    .insert(workouts)
    .values({ userId: user.id, date: new Date(date), notes: notes || null })
    .returning({ id: workouts.id })
    .get();

  // Number sets sequentially per exercise, in submission order.
  const counters = new Map<number, number>();
  const rows = entries.map((e) => {
    const n = (counters.get(e.exerciseId) ?? 0) + 1;
    counters.set(e.exerciseId, n);
    return {
      workoutId: workout.id,
      exerciseId: e.exerciseId,
      setNumber: n,
      reps: e.reps,
      weight: e.weight,
    };
  });
  await db.insert(sets).values(rows);

  revalidatePath("/dashboard");
  revalidatePath("/workouts");
  revalidatePath("/exercises");
  redirect("/workouts");
}

export async function deleteWorkout(id: number) {
  const user = await requireUser();
  await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)));
  revalidatePath("/dashboard");
  revalidatePath("/workouts");
  revalidatePath("/exercises");
}
