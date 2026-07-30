import { lisbonDateKey, round } from "./format";
import {
  addUtcDays,
  dateFromKey,
  dateKey,
  startOfUtcWeek,
} from "./workout-calendar";

export type DashboardWeekRange = {
  /** Monday at normalised UTC midnight, inclusive. */
  from: Date;
  /** The day after Lisbon's current civil day, exclusive. */
  to: Date;
};

/** Current Monday-to-today range, expressed in the database date convention. */
export function currentLisbonWeekRange(
  instant: Date = new Date(),
): DashboardWeekRange {
  const today = dateFromKey(lisbonDateKey(instant));
  return {
    from: startOfUtcWeek(today),
    to: addUtcDays(today, 1),
  };
}

export type DashboardWeekRow = {
  workoutId: number;
  date: Date;
  reps: number | null;
  weight: number | null;
};

/**
 * Counts distinct sessions and their volume in Lisbon's current civil week.
 * The range check is intentionally repeated after the database query so an
 * accidentally supplied future row can never leak into the dashboard totals.
 */
export function calculateDashboardWeekMetrics(
  rows: readonly DashboardWeekRow[],
  instant: Date = new Date(),
): { workouts: number; volume: number } {
  const { from, to } = currentLisbonWeekRange(instant);
  const fromKey = dateKey(from);
  const toKey = dateKey(to);
  const workoutIds = new Set<number>();
  let volume = 0;

  for (const row of rows) {
    if (Number.isNaN(row.date.getTime())) continue;
    const key = dateKey(row.date);
    if (key < fromKey || key >= toKey) continue;

    workoutIds.add(row.workoutId);
    if (row.reps != null && row.weight != null) {
      volume += row.reps * row.weight;
    }
  }

  return { workouts: workoutIds.size, volume };
}

export type DashboardWeightRow = {
  id: number;
  date: Date;
  weightKg: number | null;
};

/** Orders same-day readings by insertion and never treats future data as current. */
export function calculateDashboardWeightMetrics(
  rows: readonly DashboardWeightRow[],
  instant: Date = new Date(),
): {
  latestWeight: number | null;
  weightChange: number | null;
  weightSeries: { date: string; weightKg: number }[];
} {
  const tomorrowKey = dateKey(
    addUtcDays(dateFromKey(lisbonDateKey(instant)), 1),
  );
  const weights = rows
    .filter(
      (row) =>
        row.weightKg != null &&
        Number.isFinite(row.weightKg) &&
        !Number.isNaN(row.date.getTime()) &&
        dateKey(row.date) < tomorrowKey,
    )
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() || a.id - b.id,
    );
  const latestWeight = weights.at(-1)?.weightKg ?? null;
  const previousWeight = weights.at(-2)?.weightKg ?? null;

  return {
    latestWeight,
    weightChange:
      latestWeight != null && previousWeight != null
        ? round(latestWeight - previousWeight)
        : null,
    weightSeries: weights.map((row) => ({
      date: dateKey(row.date),
      weightKg: row.weightKg as number,
    })),
  };
}
