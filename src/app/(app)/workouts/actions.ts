"use server";

import { z } from "zod";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  exercises,
  plannedWorkoutGroups,
  plannedWorkouts,
  routineGroups,
  sets,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { deleteOwnedRecord } from "@/lib/owned-resource";
import { buildWorkoutSetRows, MAX_SETS_PER_WORKOUT } from "@/lib/workout";
import {
  dateFromKey,
  isDateKey,
  isPlannableDateKey,
} from "@/lib/workout-calendar";
import { isMonthKey } from "@/lib/month-calendar";
import {
  MAX_GROUPS_PER_DAY,
  MAX_GROUP_NAME_LENGTH,
  normalizeGroupNames,
} from "@/lib/muscle-groups";
import { getRoutine } from "@/lib/queries";
import { isWeekday, planRoutineApplication } from "@/lib/routine";

const entrySchema = z.object({
  exerciseId: z.number().int().positive(),
  reps: z.number().int().min(1).max(1000),
  weight: z.number().min(0).max(2000),
});

const newWorkoutSchema = z.object({
  date: z.string().refine(isDateKey),
  notes: z.string().max(1000).optional(),
  entries: z.array(entrySchema).min(1).max(MAX_SETS_PER_WORKOUT),
  plannedWorkoutId: z.number().int().positive().optional(),
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
  const { date, notes, entries, plannedWorkoutId } = parsed.data;

  if (!(await validateExercises(entries))) {
    return { error: "Um dos exercícios selecionados já não está disponível." };
  }

  const workoutDate = dateFromKey(date);
  try {
    await db.transaction(async (tx) => {
      if (plannedWorkoutId != null) {
        const plan = await tx
          .select({
            id: plannedWorkouts.id,
            date: plannedWorkouts.date,
            workoutId: plannedWorkouts.workoutId,
          })
          .from(plannedWorkouts)
          .where(
            and(
              eq(plannedWorkouts.id, plannedWorkoutId),
              eq(plannedWorkouts.userId, user.id),
            ),
          )
          .get();

        if (!plan) {
          throw new PlanLinkError("Esse plano já não está disponível.");
        }
        if (plan.date.getTime() !== workoutDate.getTime()) {
          throw new PlanLinkError("A data do treino não corresponde ao plano.");
        }
        if (plan.workoutId != null) {
          throw new PlanLinkError("Esse plano já foi concluído.");
        }
      }

      const workout = await tx
        .insert(workouts)
        .values({ userId: user.id, date: workoutDate, notes: notes || null })
        .returning({ id: workouts.id })
        .get();

      await tx
        .insert(sets)
        .values(buildWorkoutSetRows(workout.id, entries));

      if (plannedWorkoutId != null) {
        const linked = await tx
          .update(plannedWorkouts)
          .set({ workoutId: workout.id })
          .where(
            and(
              eq(plannedWorkouts.id, plannedWorkoutId),
              eq(plannedWorkouts.userId, user.id),
              eq(plannedWorkouts.date, workoutDate),
              isNull(plannedWorkouts.workoutId),
            ),
          )
          .returning({ id: plannedWorkouts.id })
          .all();
        if (linked.length !== 1) {
          throw new PlanLinkError("Esse plano já não pode ser concluído.");
        }
      }
    });
  } catch (error) {
    if (error instanceof PlanLinkError) return { error: error.message };
    throw error;
  }

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
    const workoutDate = dateFromKey(date);
    await tx
      .update(workouts)
      .set({ date: workoutDate, notes: notes || null })
      .where(eq(workouts.id, ownedWorkout.id));
    await tx.delete(sets).where(eq(sets.workoutId, ownedWorkout.id));
    await tx
      .insert(sets)
      .values(buildWorkoutSetRows(ownedWorkout.id, entries));
    // A completed plan describes a specific date. Moving its session turns
    // the edited workout into an independent one and makes the plan pending.
    await tx
      .update(plannedWorkouts)
      .set({ workoutId: null })
      .where(
        and(
          eq(plannedWorkouts.workoutId, ownedWorkout.id),
          eq(plannedWorkouts.userId, user.id),
          ne(plannedWorkouts.date, workoutDate),
        ),
      );
  });

  revalidateWorkoutPages();
  return { success: true as const };
}

const groupNamesSchema = z
  .array(z.string().max(MAX_GROUP_NAME_LENGTH))
  .max(MAX_GROUPS_PER_DAY);

const plannedWorkoutSchema = z.object({
  date: z.string().refine(isDateKey),
  templateId: z.number().int().positive().optional(),
  groups: groupNamesSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export type NewPlannedWorkoutInput = z.infer<typeof plannedWorkoutSchema>;

class PlanLinkError extends Error {}

export async function createPlannedWorkout(input: NewPlannedWorkoutInput) {
  const user = await requireUser();
  const parsed = plannedWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Escolhe uma data válida para o plano." };
  }
  const { date, templateId, notes } = parsed.data;
  const groups = normalizeGroupNames(parsed.data.groups ?? []);

  if (!isPlannableDateKey(date)) {
    return { error: "Só podes criar planos para hoje ou para uma data futura." };
  }

  if (groups.length === 0 && templateId == null && !notes?.trim()) {
    return {
      error: "Escolhe o que vais treinar, um modelo ou escreve uma nota.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      if (templateId != null) {
        const template = await tx
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
          throw new PlanLinkError("Esse modelo já não está disponível.");
        }
      }

      const plan = await tx
        .insert(plannedWorkouts)
        .values({
          userId: user.id,
          date: dateFromKey(date),
          templateId: templateId ?? null,
          notes: notes?.trim() || null,
        })
        .returning({ id: plannedWorkouts.id })
        .get();

      if (groups.length > 0) {
        await tx.insert(plannedWorkoutGroups).values(
          groups.map((name, position) => ({
            plannedWorkoutId: plan.id,
            name,
            position,
          })),
        );
      }
    });
  } catch (error) {
    if (error instanceof PlanLinkError) return { error: error.message };
    throw error;
  }

  revalidatePath("/workouts");
  return { success: true as const };
}

const routineDaySchema = z.object({
  weekday: z.number().refine(isWeekday),
  groups: groupNamesSchema,
});

export type RoutineDayInput = z.infer<typeof routineDaySchema>;

/** Replaces the groups stored for one weekday of the user's weekly split. */
export async function saveRoutineDay(input: RoutineDayInput) {
  const user = await requireUser();
  const parsed = routineDaySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Dia da semana inválido." };
  }
  const { weekday } = parsed.data;
  const groups = normalizeGroupNames(parsed.data.groups);

  await db.transaction(async (tx) => {
    await tx
      .delete(routineGroups)
      .where(
        and(
          eq(routineGroups.userId, user.id),
          eq(routineGroups.weekday, weekday),
        ),
      );
    if (groups.length > 0) {
      await tx.insert(routineGroups).values(
        groups.map((name, position) => ({
          userId: user.id,
          weekday,
          name,
          position,
        })),
      );
    }
  });

  revalidatePath("/workouts/routine");
  revalidatePath("/workouts");
  return { success: true as const, groups };
}

/**
 * Materializes the weekly split into planned workouts for a month, from today
 * onward, skipping days that already have a plan — so it is safe to re-run.
 */
export async function applyRoutineToMonth(month: string) {
  const user = await requireUser();
  if (!isMonthKey(month)) {
    return { error: "Mês inválido." };
  }

  const routine = await getRoutine(user.id);
  if (routine.length === 0) {
    return { error: "Define primeiro o que treinas em cada dia da semana." };
  }

  const toCreate = planRoutineApplication({
    month,
    routine,
    // The conditional INSERT below is the authoritative occupancy check. An
    // earlier read could race a manually created plan.
    existingPlanDates: [],
  });

  if (toCreate.length === 0) {
    return { success: true as const, created: 0 };
  }

  let created = 0;
  await db.transaction(async (tx) => {
    for (const entry of toCreate) {
      const routineDate = dateFromKey(entry.date);
      const storedDate = Math.floor(routineDate.getTime() / 1000);
      const [plan] = await tx.all<{ id: number }>(sql`
        INSERT INTO ${plannedWorkouts} (
          ${plannedWorkouts.userId},
          ${plannedWorkouts.date},
          ${plannedWorkouts.routineDate}
        )
        SELECT ${user.id}, ${storedDate}, ${storedDate}
        WHERE NOT EXISTS (
          SELECT 1
          FROM ${plannedWorkouts}
          WHERE ${plannedWorkouts.userId} = ${user.id}
            AND ${plannedWorkouts.date} = ${storedDate}
        )
        ON CONFLICT (
          ${plannedWorkouts.userId}, ${plannedWorkouts.routineDate}
        ) DO NOTHING
        RETURNING ${plannedWorkouts.id} AS id
      `);
      if (!plan) continue;

      await tx.insert(plannedWorkoutGroups).values(
        entry.groups.map((name, position) => ({
          plannedWorkoutId: plan.id,
          name,
          position,
        })),
      );
      created += 1;
    }
  });

  revalidatePath("/workouts");
  revalidatePath("/workouts/routine");
  return { success: true as const, created };
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
