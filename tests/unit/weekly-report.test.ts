import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWeeklyReport,
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

test("weekly report counts workouts, volume and sets without rounding up", () => {
  const report = calculateWeeklyReport({
    ...base,
    sets: [
      { dateKey: "2026-08-31", exercise: "Bench Press", reps: 10, weight: 50 },
      { dateKey: "2026-08-31", exercise: "Bench Press", reps: 8, weight: 52.5 },
      { dateKey: "2026-09-02", exercise: "Squat", reps: 5, weight: 100 },
      { dateKey: "2026-08-30", exercise: "Fora da semana", reps: 1, weight: 999 },
    ],
  });
  assert.equal(report.workouts, 2);
  assert.equal(report.sets, 3);
  assert.equal(report.volume, 500 + 420 + 500);
});

test("a PR only counts when the week beats previous history", () => {
  const withHistory = calculateWeeklyReport({
    ...base,
    sets: [
      { dateKey: "2026-09-01", exercise: "Bench Press", reps: 5, weight: 80 },
    ],
    previousBests: {
      "Bench Press": { epley: 93.4, weight: 80 },
    },
  });
  assert.equal(withHistory.prs.length, 0);

  const beaten = calculateWeeklyReport({
    ...base,
    sets: [
      { dateKey: "2026-09-01", exercise: "Bench Press", reps: 5, weight: 85 },
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
      { dateKey: "2026-09-01", exercise: "Pec Deck", reps: 12, weight: 40 },
    ],
  });
  assert.equal(firstTime.prs.length, 0);
});

test("calories count per day; within-goal requires an explicitly completed day", () => {
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
  // 31/08: concluído e dentro de ±10% → conta. 01/09: dentro mas por concluir.
  assert.equal(report.daysWithinGoal, 1);
  assert.equal(report.daysCompleted, 1);
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
