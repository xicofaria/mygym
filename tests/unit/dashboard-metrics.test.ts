import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDashboardWeightMetrics,
  calculateDashboardWeekMetrics,
  currentLisbonWeekRange,
  type DashboardWeekRow,
} from "../../src/lib/dashboard-metrics";
import { dateFromKey, dateKey } from "../../src/lib/workout-calendar";

test("uses the current civil Monday-to-today interval in Lisbon", () => {
  const range = currentLisbonWeekRange(
    new Date("2026-07-30T23:30:00.000Z"),
  );

  assert.equal(dateKey(range.from), "2026-07-27");
  assert.equal(dateKey(range.to), "2026-08-01");
});

test("orders same-day weights by id and excludes future readings", () => {
  const instant = new Date("2026-07-30T23:30:00.000Z"); // 31 Jul in Lisbon
  assert.deepEqual(
    calculateDashboardWeightMetrics(
      [
        { id: 3, date: dateFromKey("2026-08-01"), weightKg: 50 },
        { id: 2, date: dateFromKey("2026-07-31"), weightKg: 80 },
        { id: 1, date: dateFromKey("2026-07-31"), weightKg: 81 },
      ],
      instant,
    ),
    {
      latestWeight: 80,
      weightChange: -1,
      weightSeries: [
        { date: "2026-07-31", weightKg: 81 },
        { date: "2026-07-31", weightKg: 80 },
      ],
    },
  );
});

test("counts more than 20 workouts and excludes past and future dates", () => {
  const instant = new Date("2026-07-29T12:00:00.000Z");
  const rows: DashboardWeekRow[] = Array.from({ length: 25 }, (_, index) => ({
    workoutId: index + 1,
    date: dateFromKey("2026-07-27"),
    reps: 10,
    weight: 2,
  }));

  // A second set adds volume but must not count as a second workout.
  rows.push({
    workoutId: 1,
    date: dateFromKey("2026-07-27"),
    reps: 5,
    weight: 1,
  });
  rows.push({
    workoutId: 26,
    date: dateFromKey("2026-07-30"),
    reps: 10,
    weight: 100,
  });
  rows.push({
    workoutId: 27,
    date: dateFromKey("2026-07-26"),
    reps: 10,
    weight: 100,
  });

  assert.deepEqual(calculateDashboardWeekMetrics(rows, instant), {
    workouts: 25,
    volume: 505,
  });
});
