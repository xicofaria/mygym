import "server-only";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  bodyMetrics,
  exercises,
  plannedWorkouts,
  sets,
  users,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import { requireUser } from "./auth";
import { epley1RM, round } from "./format";
import { resolveViewedUserId } from "./viewer";
import { chooseTopSet } from "./workout";
import {
  buildWorkoutCalendar,
  type WorkoutCalendarData,
} from "./workout-calendar";

/** All users, for the "whose data am I viewing" switcher. */
export async function getAllUsers() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
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
    email: me.email,
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
  date: string; // ISO day
  maxWeight: number;
  best1RM: number;
  volume: number;
  topSet: string; // e.g. "24kg × 12"
};

/** Per-session progression for one exercise + user (oldest → newest). */
export async function getExerciseProgression(
  exerciseId: number,
  userId: number,
): Promise<{
  exercise: { id: number; name: string } | null;
  points: ProgressionPoint[];
}> {
  const exercise = await db
    .select({ id: exercises.id, name: exercises.name })
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

  const points: ProgressionPoint[] = [...bySession.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      maxWeight: round(s.maxWeight),
      best1RM: round(s.best1RM),
      volume: round(s.volume),
      topSet: `${round(s.maxWeight)}kg × ${s.topReps}`,
    }));

  return { exercise, points };
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
  const [recent, workoutDates, bodyMetricRows] = await Promise.all([
    getWorkouts(userId, 20),
    db
      .select({ date: workouts.date })
      .from(workouts)
      .where(eq(workouts.userId, userId))
      .all(),
    getBodyMetrics(userId),
  ]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  let workoutsThisWeek = 0;
  let volumeThisWeek = 0;
  for (const w of recent) {
    if (w.date >= weekAgo) {
      workoutsThisWeek += 1;
      for (const g of w.groups)
        for (const s of g.sets) volumeThisWeek += s.weight * s.reps;
    }
  }

  const totalWorkouts = workoutDates.length;

  const weights = bodyMetricRows
    .filter((m) => m.weightKg != null)
    .map((m) => ({ date: m.date, weightKg: m.weightKg as number }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const latestWeight = weights.at(-1)?.weightKg ?? null;
  const prevWeight = weights.at(-2)?.weightKg ?? null;
  const weightChange =
    latestWeight != null && prevWeight != null
      ? round(latestWeight - prevWeight)
      : null;

  return {
    workoutsThisWeek,
    volumeThisWeek: round(volumeThisWeek),
    totalWorkouts,
    latestWeight,
    weightChange,
    weightSeries: weights.map((w) => ({
      date: w.date.toISOString().slice(0, 10),
      weightKg: w.weightKg,
    })),
    calendar: buildWorkoutCalendar(workoutDates.map((workout) => workout.date)),
    recent: recent.slice(0, 5),
  };
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
  template: { id: number; name: string } | null;
};

/** Planned workouts within [from, to), with the template they came from. */
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
    with: { template: true },
  });
  return rows.map((plan) => ({
    id: plan.id,
    date: plan.date,
    notes: plan.notes,
    template: plan.template
      ? { id: plan.template.id, name: plan.template.name }
      : null,
  }));
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
    })),
  };
}
