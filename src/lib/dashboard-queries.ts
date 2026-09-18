import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { sets, workouts } from "@/db/schema";
import { round } from "./format";
import { calculateDashboardWeightMetrics, calculateDashboardWeekMetrics, currentLisbonWeekRange } from "./dashboard-metrics";
import { buildWorkoutCalendar } from "./workout-calendar";
import type { WorkoutCalendarData } from "./workout-calendar";
import { getWorkouts, type WorkoutWithSets } from "./workout-queries";
import { getBodyMetrics } from "./body-queries";

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

