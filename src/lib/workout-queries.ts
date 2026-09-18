import "server-only";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  plannedWorkouts,
  routineGroups,
  sets,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import type { RoutineDay } from "./routine";

export type WorkoutWithSets = {
  id: number;
  date: Date;
  notes: string | null;
  /** Sets grouped by exercise, in the order first performed. */
  groups: {
    exerciseId: number;
    exerciseName: string;
    sets: { setNumber: number; reps: number; weight: number }[];
  }[];
};

/** Recent workouts for a user, with their sets grouped by exercise. */
export async function getWorkouts(
  userId: number,
  limit?: number,
  date?: Date,
): Promise<WorkoutWithSets[]> {
  const rows = await db.query.workouts.findMany({
    where: date
      ? and(eq(workouts.userId, userId), eq(workouts.date, date))
      : eq(workouts.userId, userId),
    orderBy: [desc(workouts.date), desc(workouts.id)],
    limit,
    with: {
      sets: {
        orderBy: (s, { asc }) => [asc(s.setNumber)],
        with: { exercise: true },
      },
    },
  });

  return rows.map((w) => {
    const groups: WorkoutWithSets["groups"] = [];
    const byExercise = new Map<number, WorkoutWithSets["groups"][number]>();
    for (const s of w.sets) {
      let g = byExercise.get(s.exerciseId);
      if (!g) {
        g = {
          exerciseId: s.exerciseId,
          exerciseName: s.exercise.name,
          sets: [],
        };
        byExercise.set(s.exerciseId, g);
        groups.push(g);
      }
      g.sets.push({ setNumber: s.setNumber, reps: s.reps, weight: s.weight });
    }
    return { id: w.id, date: w.date, notes: w.notes, groups };
  });
}

export type WorkoutFormData = {
  id: number;
  date: string;
  notes: string;
  entries: { exerciseId: number; reps: number; weight: number }[];
};

async function workoutToFormData(
  row:
    | (typeof workouts.$inferSelect & {
        sets: (typeof sets.$inferSelect)[];
      })
    | undefined,
): Promise<WorkoutFormData | null> {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    notes: row.notes ?? "",
    entries: row.sets.map((set) => ({
      exerciseId: set.exerciseId,
      reps: set.reps,
      weight: set.weight,
    })),
  };
}

/** A single workout, strictly scoped to its owner, prepared for editing. */
export async function getWorkoutForEdit(
  id: number,
  userId: number,
): Promise<WorkoutFormData | null> {
  const row = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, id), eq(workouts.userId, userId)),
    with: {
      sets: { orderBy: (set, { asc }) => [asc(set.id)] },
    },
  });
  return workoutToFormData(row);
}

/** The latest workout for quickly starting a new session with the same sets. */
export async function getLatestWorkoutForRepeat(
  userId: number,
): Promise<WorkoutFormData | null> {
  const row = await db.query.workouts.findFirst({
    where: eq(workouts.userId, userId),
    orderBy: [desc(workouts.date), desc(workouts.id)],
    with: {
      sets: { orderBy: (set, { asc }) => [asc(set.id)] },
    },
  });
  return workoutToFormData(row);
}

export type TemplateWithExercises = {
  id: number;
  name: string;
  exercises: { id: number; name: string }[];
};

/** Reusable named routines belonging to a user (e.g. "Treino de Pernas"). */
export async function getWorkoutTemplates(
  userId: number,
): Promise<TemplateWithExercises[]> {
  const rows = await db.query.workoutTemplates.findMany({
    where: eq(workoutTemplates.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    with: {
      items: {
        orderBy: (i, { asc }) => [asc(i.position)],
        with: { exercise: true },
      },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    exercises: t.items.map((i) => ({
      id: i.exercise.id,
      name: i.exercise.name,
    })),
  }));
}

/** Dates of every workout within [from, to), for calendar aggregation. */
export async function getWorkoutDatesInRange(
  userId: number,
  from: Date,
  to: Date,
): Promise<Date[]> {
  const rows = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, from),
        lt(workouts.date, to),
      ),
    )
    .all();
  return rows.map((row) => row.date);
}

export type PlannedWorkoutWithTemplate = {
  id: number;
  date: Date;
  notes: string | null;
  workoutId: number | null;
  /** Muscle groups this session trains, in display order. */
  groups: string[];
  template: { id: number; name: string } | null;
};

function toPlannedWorkoutWithTemplate(plan: {
  id: number;
  date: Date;
  notes: string | null;
  workoutId: number | null;
  groups: { name: string }[];
  template: { id: number; name: string } | null;
}): PlannedWorkoutWithTemplate {
  return {
    id: plan.id,
    date: plan.date,
    notes: plan.notes,
    workoutId: plan.workoutId,
    groups: plan.groups.map((group) => group.name),
    template: plan.template
      ? { id: plan.template.id, name: plan.template.name }
      : null,
  };
}

/** Planned workouts within [from, to), with their groups and template. */
export async function getPlannedWorkouts(
  userId: number,
  from: Date,
  to: Date,
): Promise<PlannedWorkoutWithTemplate[]> {
  const rows = await db.query.plannedWorkouts.findMany({
    where: and(
      eq(plannedWorkouts.userId, userId),
      gte(plannedWorkouts.date, from),
      lt(plannedWorkouts.date, to),
    ),
    orderBy: [asc(plannedWorkouts.date), asc(plannedWorkouts.id)],
    with: {
      template: true,
      groups: { orderBy: (g, { asc: ascending }) => [ascending(g.position)] },
    },
  });
  return rows.map(toPlannedWorkoutWithTemplate);
}

/** One plan scoped to its owner, used when registering that exact session. */
export async function getPlannedWorkout(
  id: number,
  userId: number,
): Promise<PlannedWorkoutWithTemplate | null> {
  const plan = await db.query.plannedWorkouts.findFirst({
    where: and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId)),
    with: {
      template: true,
      groups: { orderBy: (g, { asc: ascending }) => [ascending(g.position)] },
    },
  });
  return plan ? toPlannedWorkoutWithTemplate(plan) : null;
}

/** The user's weekly split, one entry per weekday that has any groups. */
export async function getRoutine(userId: number): Promise<RoutineDay[]> {
  const rows = await db
    .select({
      weekday: routineGroups.weekday,
      name: routineGroups.name,
    })
    .from(routineGroups)
    .where(eq(routineGroups.userId, userId))
    .orderBy(asc(routineGroups.weekday), asc(routineGroups.position))
    .all();

  const byWeekday = new Map<number, string[]>();
  for (const row of rows) {
    const groups = byWeekday.get(row.weekday);
    if (groups) groups.push(row.name);
    else byWeekday.set(row.weekday, [row.name]);
  }
  return [...byWeekday.entries()]
    .map(([weekday, groups]) => ({ weekday, groups }))
    .sort((a, b) => a.weekday - b.weekday);
}

/** A single template (scoped to the owner) for pre-filling a new workout. */
export async function getWorkoutTemplate(
  id: number,
  userId: number,
): Promise<TemplateWithExercises | null> {
  const t = await db.query.workoutTemplates.findFirst({
    where: and(
      eq(workoutTemplates.id, id),
      eq(workoutTemplates.userId, userId),
    ),
    with: {
      items: {
        orderBy: (i, { asc }) => [asc(i.position)],
        with: { exercise: true },
      },
    },
  });
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    exercises: t.items.map((i) => ({
      id: i.exercise.id,
      name: i.exercise.name,
    })),
  };
}

