import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bodyMetrics, exercises, sets, workouts } from "@/db/schema";
import { epley1RM, lisbonDateKey } from "./format";
import { calculateWeeklyReport } from "./weekly-report";
import { getCalorieData } from "./calorie-queries";
import { addUtcDays, dateFromKey, dateKey, startOfUtcWeek } from "./workout-calendar";

/** Previous Lisbon week (Monday-to-Monday), for the weekly report. */
export function previousLisbonWeekRange(instant: Date = new Date()): {
  from: Date;
  to: Date;
} {
  const today = dateFromKey(lisbonDateKey(instant));
  const from = addUtcDays(startOfUtcWeek(today), -7);
  return { from, to: addUtcDays(from, 7) };
}

export type WeeklyReportData = Parameters<typeof calculateWeeklyReport>[0];

/** Assembles everything the weekly report calculates, from real rows. */
export async function getWeeklyReportData(
  userId: number,
  from: Date,
  to: Date,
): Promise<WeeklyReportData> {
  // `from`/`to` já são datas-só à meia-noite UTC (convenção da base de dados).
  const fromKey = dateKey(from);
  const toKey = dateKey(to);

  // Quatro leituras independentes: o cron semanal repete-as por conta.
  const [weekRows, beforeRows, weightRows, { entries, goals, days }] =
    await Promise.all([
      db
        .select({
          workoutId: workouts.id,
          date: workouts.date,
          exercise: exercises.name,
          reps: sets.reps,
          weight: sets.weight,
        })
        .from(workouts)
        .innerJoin(sets, eq(sets.workoutId, workouts.id))
        .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
        .where(
          and(
            eq(workouts.userId, userId),
            gte(workouts.date, from),
            lt(workouts.date, to),
          ),
        )
        .orderBy(asc(workouts.date))
        .all(),
      db
        .select({
          exercise: exercises.name,
          reps: sets.reps,
          weight: sets.weight,
        })
        .from(workouts)
        .innerJoin(sets, eq(sets.workoutId, workouts.id))
        .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
        .where(
          and(
            eq(workouts.userId, userId),
            lt(workouts.date, from),
            gte(sets.reps, 1),
            gte(sets.weight, 0),
          ),
        )
        .all(),
      db
        .select({ date: bodyMetrics.date, kg: bodyMetrics.weightKg })
        .from(bodyMetrics)
        .where(
          and(
            eq(bodyMetrics.userId, userId),
            gte(bodyMetrics.date, addUtcDays(from, -365)),
          ),
        )
        .orderBy(asc(bodyMetrics.date))
        .all(),
      getCalorieData(userId, fromKey, toKey),
    ]);

  const previousBests: WeeklyReportData["previousBests"] = {};
  for (const row of beforeRows) {
    if (row.reps == null || row.weight == null) continue;
    const oneRm = epley1RM(row.weight, row.reps);
    const current = previousBests[row.exercise];
    if (!current || oneRm > current.epley) {
      previousBests[row.exercise] = {
        epley: oneRm,
        weight: row.weight,
      };
    }
  }

  return {
    fromKey,
    toKey,
    sets: weekRows.map((row) => ({
      workoutId: row.workoutId,
      dateKey: dateKey(row.date),
      exercise: row.exercise,
      reps: row.reps,
      weight: row.weight,
    })),
    previousBests,
    weights: weightRows
      .filter((row) => row.kg != null)
      .map((row) => ({ dateKey: dateKey(row.date), kg: row.kg as number })),
    // Uma linha por consumo; o relatório agrega por dia civil.
    calories: entries.map((entry) => ({
      dateKey: entry.date,
      kcal: ((entry.snapshot.nutrients.kcal ?? 0) * entry.quantity) / 100,
    })),
    completedDays: days
      .filter((day) => day.completed)
      .map((day) => day.date),
    goals,
  };
}
