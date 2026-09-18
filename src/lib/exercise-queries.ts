import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises, exerciseFavorites, sets, workouts } from "@/db/schema";
import { requireUser } from "./auth";
import { visibleExercises } from "./exercise-access";
import { epley1RM, round } from "./format";
import { chooseTopSet } from "./workout";
import { enrichExercise } from "./exercise-catalog";

export async function getExerciseCatalog() {
  const user = await requireUser();
  const catalog = await db
    .select()
    .from(exercises)
    .where(visibleExercises(user.id))
    .orderBy(asc(exercises.name))
    .all();
  return catalog.map(enrichExercise);
}

/** Private preferences: callers cannot choose another account. */
export async function getFavoriteExerciseIds() {
  const user = await requireUser();
  const favorites = await db
    .select({ exerciseId: exerciseFavorites.exerciseId })
    .from(exerciseFavorites)
    .where(eq(exerciseFavorites.userId, user.id))
    .all();
  return favorites.map((favorite) => favorite.exerciseId);
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
  userId: number | null;
  name: string;
  muscleGroup: string | null;
  aliases: string;
  equipment: string;
  totalSets: number;
  bestWeight: number | null;
  best1RM: number | null;
  lastPerformed: Date | null;
  lastPerformance: string | null;
};

/** The full catalog, annotated with this user's stats for each movement. */
export async function getExercisesWithStats(
  userId: number,
): Promise<ExerciseStat[]> {
  const catalog = await getExerciseCatalog();
  const lastPerformance = await getLastPerformanceByExercise(userId);
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
      userId: e.userId,
      name: e.name,
      muscleGroup: e.muscleGroup,
      aliases: e.aliases,
      equipment: e.equipment,
      totalSets: st?.total ?? 0,
      bestWeight: st ? round(st.bestWeight) : null,
      best1RM: st ? round(st.best1RM) : null,
      lastPerformed: st?.last ?? null,
      lastPerformance: lastPerformance[e.id]?.summary ?? null,
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
    .where(and(eq(exercises.id, exerciseId), visibleExercises(userId)))
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
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() || a.workoutId - b.workoutId,
    )
    .map((s) => ({
      workoutId: s.workoutId,
      date: s.date.toISOString().slice(0, 10),
      maxWeight: round(s.maxWeight),
      best1RM: round(s.best1RM),
      volume: round(s.volume),
      topSet: `${round(s.maxWeight)}kg × ${s.topReps}`,
    }));

  return { exercise, points };
}

