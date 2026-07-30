import "server-only";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  bodyMetrics,
  exercises,
  plannedWorkouts,
  routineGroups,
  sets,
  users,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import type { RoutineDay } from "./routine";
import { requireUser } from "./auth";
import { epley1RM, round } from "./format";
import {
  calculateDashboardWeightMetrics,
  calculateDashboardWeekMetrics,
  currentLisbonWeekRange,
} from "./dashboard-metrics";
import { markRecords, type RecordFlags } from "./personal-records";
import { resolveViewedUserId } from "./viewer";
import { chooseTopSet } from "./workout";
import {
  buildWorkoutCalendar,
  type WorkoutCalendarData,
} from "./workout-calendar";

/** All users, for the "whose data am I viewing" switcher. */
export async function getAllUsers() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(asc(users.id))
    .all();
}

/**
 * Shared per-page setup: the signed-in user, everyone (for the switcher), and
 * whose data this page should render (from the ?user= param, default self).
 */
export async function getPageContext(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
) {
  const [me, allUsers, sp] = await Promise.all([
    requireUser(),
    getAllUsers(),
    searchParams,
  ]);
  const viewedId = resolveViewedUserId(
    sp.user,
    me.id,
    allUsers.map((u) => u.id),
  );
  const viewed = allUsers.find((u) => u.id === viewedId) ?? {
    id: me.id,
    name: me.name,
  };
  const isSelf = viewedId === me.id;
  /** Append to internal links to keep viewing the same person. */
  const query = isSelf ? "" : `?user=${viewedId}`;
  return { me, allUsers, viewed, viewedId, isSelf, query };
}

export async function getExerciseCatalog() {
  return db.select().from(exercises).orderBy(asc(exercises.name)).all();
}

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

export type LastPerformance = Record<
  number,
  { workoutId: number; date: string; summary: string }
>;

/** Most recent complete set summary for every exercise performed by a user. */
export async function getLastPerformanceByExercise(
  userId: number,
): Promise<LastPerformance> {
  const rows = await db
    .select({
      workoutId: workouts.id,
      exerciseId: sets.exerciseId,
      date: workouts.date,
      setNumber: sets.setNumber,
      reps: sets.reps,
      weight: sets.weight,
    })
    .from(sets)
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date), desc(workouts.id), asc(sets.setNumber))
    .all();

  const latestWorkoutByExercise = new Map<number, number>();
  const grouped = new Map<
    number,
    { workoutId: number; date: Date; sets: { reps: number; weight: number }[] }
  >();

  for (const row of rows) {
    const latestWorkoutId = latestWorkoutByExercise.get(row.exerciseId);
    if (latestWorkoutId != null && latestWorkoutId !== row.workoutId) continue;
    latestWorkoutByExercise.set(row.exerciseId, row.workoutId);

    const current = grouped.get(row.exerciseId);
    if (current) {
      current.sets.push({ reps: row.reps, weight: row.weight });
    } else {
      grouped.set(row.exerciseId, {
        workoutId: row.workoutId,
        date: row.date,
        sets: [{ reps: row.reps, weight: row.weight }],
      });
    }
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([exerciseId, value]) => [
      exerciseId,
      {
        workoutId: value.workoutId,
        date: value.date.toISOString().slice(0, 10),
        summary: value.sets
          .map((set) => `${round(set.weight)}kg × ${set.reps}`)
          .join(" · "),
      },
    ]),
  );
}

export type ExerciseStat = {
  id: number;
  name: string;
  muscleGroup: string | null;
  totalSets: number;
  bestWeight: number | null;
  best1RM: number | null;
  lastPerformed: Date | null;
};

/** The full catalog, annotated with this user's stats for each movement. */
export async function getExercisesWithStats(
  userId: number,
): Promise<ExerciseStat[]> {
  const catalog = await getExerciseCatalog();
  const userSets = await db
    .select({
      exerciseId: sets.exerciseId,
      weight: sets.weight,
      reps: sets.reps,
      date: workouts.date,
    })
    .from(sets)
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(eq(workouts.userId, userId))
    .all();

  const stats = new Map<
    number,
    { total: number; bestWeight: number; best1RM: number; last: Date }
  >();
  for (const s of userSets) {
    const cur = stats.get(s.exerciseId);
    const oneRm = epley1RM(s.weight, s.reps);
    if (!cur) {
      stats.set(s.exerciseId, {
        total: 1,
        bestWeight: s.weight,
        best1RM: oneRm,
        last: s.date,
      });
    } else {
      cur.total += 1;
      cur.bestWeight = Math.max(cur.bestWeight, s.weight);
      cur.best1RM = Math.max(cur.best1RM, oneRm);
      if (s.date > cur.last) cur.last = s.date;
    }
  }

  return catalog.map((e) => {
    const st = stats.get(e.id);
    return {
      id: e.id,
      name: e.name,
      muscleGroup: e.muscleGroup,
      totalSets: st?.total ?? 0,
      bestWeight: st ? round(st.bestWeight) : null,
      best1RM: st ? round(st.best1RM) : null,
      lastPerformed: st?.last ?? null,
    };
  });
}

export type ProgressionPoint = {
  /** The session this point came from. Two workouts can share a date, so this
   * — not `date` — is what uniquely identifies a point. */
  workoutId: number;
  date: string; // ISO day
  maxWeight: number;
  best1RM: number;
  volume: number;
  topSet: string; // e.g. "24kg × 12"
  /** Set when this session beat every earlier one for this exercise. */
  record?: RecordFlags;
};

/** Per-session progression for one exercise + user (oldest → newest). */
export async function getExerciseProgression(
  exerciseId: number,
  userId: number,
): Promise<{
  exercise: { id: number; name: string; muscleGroup: string | null } | null;
  points: ProgressionPoint[];
}> {
  const exercise = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
    })
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .get();
  if (!exercise) return { exercise: null, points: [] };

  const rows = await db
    .select({
      workoutId: workouts.id,
      date: workouts.date,
      reps: sets.reps,
      weight: sets.weight,
    })
    .from(sets)
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(and(eq(sets.exerciseId, exerciseId), eq(workouts.userId, userId)))
    .orderBy(asc(workouts.date))
    .all();

  const bySession = new Map<
    number,
    {
      date: Date;
      maxWeight: number;
      best1RM: number;
      volume: number;
      topReps: number;
    }
  >();
  for (const r of rows) {
    const oneRm = epley1RM(r.weight, r.reps);
    const cur = bySession.get(r.workoutId);
    if (!cur) {
      bySession.set(r.workoutId, {
        date: r.date,
        maxWeight: r.weight,
        best1RM: oneRm,
        volume: r.weight * r.reps,
        topReps: r.reps,
      });
    } else {
      cur.volume += r.weight * r.reps;
      cur.best1RM = Math.max(cur.best1RM, oneRm);
      const top = chooseTopSet(
        { weight: cur.maxWeight, reps: cur.topReps },
        { weight: r.weight, reps: r.reps },
      );
      cur.maxWeight = top.weight;
      cur.topReps = top.reps;
    }
  }

  const points: ProgressionPoint[] = [...bySession.entries()]
    .map(([workoutId, session]) => ({ workoutId, ...session }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.workoutId - b.workoutId)
    .map((s) => ({
      workoutId: s.workoutId,
      date: s.date.toISOString().slice(0, 10),
      maxWeight: round(s.maxWeight),
      best1RM: round(s.best1RM),
      volume: round(s.volume),
      topSet: `${round(s.maxWeight)}kg × ${s.topReps}`,
    }));

  // Mark on the rounded values, so a badge never contradicts the number shown.
  const records = markRecords(points);
  for (const point of points) {
    const flags = records.get(point.workoutId);
    if (flags) point.record = flags;
  }

  return { exercise, points };
}

/** Which exercises each session set a personal record for. */
export async function getPersonalRecords(
  userId: number,
): Promise<Map<number, Set<number>>> {
  const rows = await db
    .select({
      workoutId: workouts.id,
      exerciseId: sets.exerciseId,
      date: workouts.date,
      reps: sets.reps,
      weight: sets.weight,
    })
    .from(sets)
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(eq(workouts.userId, userId))
    .all();

  // exerciseId → workoutId → that session's best effort
  const byExercise = new Map<
    number,
    Map<number, { workoutId: number; date: string; maxWeight: number; best1RM: number }>
  >();
  for (const row of rows) {
    let sessions = byExercise.get(row.exerciseId);
    if (!sessions) {
      sessions = new Map();
      byExercise.set(row.exerciseId, sessions);
    }
    const oneRm = round(epley1RM(row.weight, row.reps));
    const weight = round(row.weight);
    const current = sessions.get(row.workoutId);
    if (!current) {
      sessions.set(row.workoutId, {
        workoutId: row.workoutId,
        date: row.date.toISOString().slice(0, 10),
        maxWeight: weight,
        best1RM: oneRm,
      });
    } else {
      current.maxWeight = Math.max(current.maxWeight, weight);
      current.best1RM = Math.max(current.best1RM, oneRm);
    }
  }

  const byWorkout = new Map<number, Set<number>>();
  for (const [exerciseId, sessions] of byExercise) {
    for (const workoutId of markRecords([...sessions.values()]).keys()) {
      const forWorkout = byWorkout.get(workoutId) ?? new Set<number>();
      forWorkout.add(exerciseId);
      byWorkout.set(workoutId, forWorkout);
    }
  }
  return byWorkout;
}

export async function getBodyMetrics(userId: number) {
  return db
    .select()
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.date), desc(bodyMetrics.id))
    .all();
}

export type Dashboard = {
  workoutsThisWeek: number;
  volumeThisWeek: number;
  totalWorkouts: number;
  latestWeight: number | null;
  weightChange: number | null; // vs. previous entry
  weightSeries: { date: string; weightKg: number }[];
  calendar: WorkoutCalendarData;
  recent: WorkoutWithSets[];
};

export async function getDashboard(userId: number): Promise<Dashboard> {
  const now = new Date();
  const weekRange = currentLisbonWeekRange(now);
  const [recent, workoutDates, weekRows, bodyMetricRows] = await Promise.all([
    getWorkouts(userId, 5),
    db
      .select({ date: workouts.date })
      .from(workouts)
      .where(eq(workouts.userId, userId))
      .all(),
    db
      .select({
        workoutId: workouts.id,
        date: workouts.date,
        reps: sets.reps,
        weight: sets.weight,
      })
      .from(workouts)
      .leftJoin(sets, eq(sets.workoutId, workouts.id))
      .where(
        and(
          eq(workouts.userId, userId),
          gte(workouts.date, weekRange.from),
          lt(workouts.date, weekRange.to),
        ),
      )
      .all(),
    getBodyMetrics(userId),
  ]);
  const weekMetrics = calculateDashboardWeekMetrics(weekRows, now);
  const weightMetrics = calculateDashboardWeightMetrics(bodyMetricRows, now);

  const totalWorkouts = workoutDates.length;

  return {
    workoutsThisWeek: weekMetrics.workouts,
    volumeThisWeek: round(weekMetrics.volume),
    totalWorkouts,
    latestWeight: weightMetrics.latestWeight,
    weightChange: weightMetrics.weightChange,
    weightSeries: weightMetrics.weightSeries,
    calendar: buildWorkoutCalendar(workoutDates.map((workout) => workout.date)),
    recent,
  };
}

export type TemplateWithExercises = {
  id: number;
  name: string;
  exercises: { id: number; name: string; muscleGroup: string | null }[];
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
      muscleGroup: i.exercise.muscleGroup,
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
    where: and(
      eq(plannedWorkouts.id, id),
      eq(plannedWorkouts.userId, userId),
    ),
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
    where: and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)),
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
      muscleGroup: i.exercise.muscleGroup,
    })),
  };
}
