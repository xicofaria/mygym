import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWeeklyReport,
  caloriesPerDay,
  type WeeklyReportInput,
} from "../../src/lib/weekly-report";

const base: WeeklyReportInput = {
  fromKey: "2026-08-31",
  toKey: "2026-09-07",
  sets: [],
  previousBests: {},
  weights: [],
  calories: [],
  completedDays: [],
  goals: [],
};

test("counts distinct workouts (two sessions on the same day are two) and volume", () => {
  const report = calculateWeeklyReport({
    ...base,
    sets: [
      { workoutId: 1, dateKey: "2026-08-31", exercise: "Bench Press", reps: 10, weight: 50 },
      { workoutId: 1, dateKey: "2026-08-31", exercise: "Bench Press", reps: 8, weight: 52.5 },
      { workoutId: 2, dateKey: "2026-08-31", exercise: "Squat", reps: 5, weight: 100 },
      { workoutId: 2, dateKey: "2026-09-02", exercise: "Squat", reps: 5, weight: 100 },
      { workoutId: 99, dateKey: "2026-08-30", exercise: "Fora da semana", reps: 1, weight: 999 },
    ],
  });
  // Treino 1 (31/08) + treino 2 (31/08 e 02/09) = 2 treinos distintos.
  assert.equal(report.workouts, 2);
  assert.equal(report.sets, 4);
  assert.equal(report.volume, 500 + 420 + 500 + 500);
});

test("a PR only counts when the week beats previous history", () => {
  const withHistory = calculateWeeklyReport({
    ...base,
    sets: [
      { workoutId: 1, dateKey: "2026-09-01", exercise: "Bench Press", reps: 5, weight: 80 },
    ],
    previousBests: {
      "Bench Press": { epley: 93.4, weight: 80 },
    },
  });
  assert.equal(withHistory.prs.length, 0);

  const beaten = calculateWeeklyReport({
    ...base,
    sets: [
      { workoutId: 1, dateKey: "2026-09-01", exercise: "Bench Press", reps: 5, weight: 85 },
    ],
    previousBests: {
      "Bench Press": { epley: 93.4, weight: 80 },
    },
  });
  assert.deepEqual(beaten.prs, [
    { exercise: "Bench Press", detail: "85kg × 5" },
  ]);

  const firstTime = calculateWeeklyReport({
    ...base,
    sets: [
      { workoutId: 1, dateKey: "2026-09-01", exercise: "Pec Deck", reps: 12, weight: 40 },
    ],
  });
  assert.equal(firstTime.prs.length, 0);
});

test("calories aggregate per day; within-goal requires an explicitly completed day", () => {
  const report = calculateWeeklyReport({
    ...base,
    calories: [
      { dateKey: "2026-08-31", kcal: 2000 },
      { dateKey: "2026-09-01", kcal: 2400 },
    ],
    completedDays: ["2026-08-31"],
    goals: [{ effectiveFrom: "2026-08-01", kcal: 2200, tolerance: 10 }],
  });
  assert.equal(report.kcalTotal, 4400);
  assert.equal(report.kcalRecordedDays, 2);
  assert.equal(report.kcalAvg, 2200);
  assert.equal(report.daysWithinGoal, 1);
  assert.equal(report.daysCompleted, 1);
});

test("caloriesPerDay merges multiple entries of the same civil day", () => {
  const perDay = caloriesPerDay([
    { dateKey: "2026-09-01", kcal: 1000 },
    { dateKey: "2026-09-01", kcal: 1000 },
    { dateKey: "2026-09-02", kcal: 500 },
  ]);
  assert.deepEqual(perDay, [
    { dateKey: "2026-09-01", kcal: 2000 },
    { dateKey: "2026-09-02", kcal: 500 },
  ]);

  const report = calculateWeeklyReport({
    ...base,
    calories: caloriesPerDay([
      { dateKey: "2026-08-31", kcal: 1000 },
      { dateKey: "2026-08-31", kcal: 1000 },
    ]),
    completedDays: ["2026-08-31"],
    goals: [{ effectiveFrom: "2026-08-01", kcal: 2000, tolerance: 10 }],
  });
  // 1 dia registado, média 2000 e o dia conta como dentro da meta.
  assert.equal(report.kcalRecordedDays, 1);
  assert.equal(report.kcalAvg, 2000);
  assert.equal(report.daysWithinGoal, 1);
});

test("weight change compares the last in-week reading with the last before it", () => {
  const report = calculateWeeklyReport({
    ...base,
    weights: [
      { dateKey: "2026-08-20", kg: 80 },
      { dateKey: "2026-09-01", kg: 79.2 },
      { dateKey: "2026-09-03", kg: 79.5 },
    ],
  });
  assert.equal(report.weightChange, -0.5);
  const noHistory = calculateWeeklyReport({
    ...base,
    weights: [{ dateKey: "2026-09-01", kg: 79.2 }],
  });
  assert.equal(noHistory.weightChange, null);
});
