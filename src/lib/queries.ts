import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bodyMetrics,
  exercises,
  sets,
  users,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import { requireUser } from "./auth";
import { epley1RM, round } from "./format";
import { resolveViewedUserId } from "./viewer";

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
): Promise<WorkoutWithSets[]> {
  const rows = await db.query.workouts.findMany({
    where: eq(workouts.userId, userId),
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
      if (r.weight > cur.maxWeight) {
        cur.maxWeight = r.weight;
        cur.topReps = r.reps;
      }
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
  recent: WorkoutWithSets[];
};

export async function getDashboard(userId: number): Promise<Dashboard> {
  const recent = await getWorkouts(userId, 20);

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

  const totalWorkouts = (
    await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(eq(workouts.userId, userId))
      .all()
  ).length;

  const weights = (await getBodyMetrics(userId))
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
