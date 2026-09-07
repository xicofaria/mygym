import { epley1RM, round } from "./format";
import { goalForDate, type CalorieGoal } from "./nutrition";

export type WeeklySetRow = {
  dateKey: string;
  exercise: string;
  reps: number | null;
  weight: number | null;
};

export type WeeklyReportInput = {
  /** Monday of the reported week (inclusive), next Monday (exclusive). */
  fromKey: string;
  toKey: string;
  sets: WeeklySetRow[];
  /** Best 1RM estimate and weight per exercise BEFORE this week. */
  previousBests: Record<string, { epley: number; weight: number }>;
  weights: { dateKey: string; kg: number }[];
  calories: { dateKey: string; kcal: number }[];
  /** Civil days explicitly completed by the user. */
  completedDays: string[];
  goals: CalorieGoal[];
};

export type WeeklyReport = {
  fromKey: string;
  toKey: string;
  workouts: number;
  volume: number;
  sets: number;
  prs: { exercise: string; detail: string }[];
  kcalTotal: number | null;
  kcalRecordedDays: number;
  kcalAvg: number | null;
  daysWithinGoal: number;
  daysCompleted: number;
  goalKcal: number | null;
  weightChange: number | null;
};

const inWindow = (dateKey: string, input: WeeklyReportInput) =>
  dateKey >= input.fromKey && dateKey < input.toKey;

export function calculateWeeklyReport(input: WeeklyReportInput): WeeklyReport {
  const weekSets = input.sets.filter((row) => inWindow(row.dateKey, input));

  const workoutDays = new Set(weekSets.map((row) => row.dateKey));
  let volume = 0;
  let sets = 0;
  const weekBests = new Map<
    string,
    { epley: number; weight: number; detail: string }
  >();
  for (const row of weekSets) {
    const reps = row.reps;
    const weight = row.weight;
    if (reps == null || weight == null || !Number.isFinite(reps) || !Number.isFinite(weight))
      continue;
    sets += 1;
    volume += reps * weight;
    const oneRm = epley1RM(weight, reps);
    const current = weekBests.get(row.exercise);
    if (!current || oneRm > current.epley) {
      weekBests.set(row.exercise, {
        epley: oneRm,
        weight,
        detail: `${round(weight)}kg × ${reps}`,
      });
    }
  }

  // Um PR existe quando a semana supera o histórico anterior do exercício.
  const prs: { exercise: string; detail: string }[] = [];
  for (const [exercise, best] of weekBests) {
    const previous = input.previousBests[exercise];
    if (!previous) continue;
    if (best.epley > previous.epley + 0.05) {
      prs.push({ exercise, detail: best.detail });
    }
  }
  prs.sort((a, b) => a.exercise.localeCompare(b.exercise));

  const calories = input.calories.filter((row) => inWindow(row.dateKey, input));
  const kcalTotal = calories.reduce((sum, row) => sum + row.kcal, 0);
  const kcalRecordedDays = calories.length;
  const completed = new Set(input.completedDays);
  let daysWithinGoal = 0;
  let lastGoalKcal: number | null = null;
  for (const row of calories) {
    const goal = goalForDate(input.goals, row.dateKey);
    if (!goal || !completed.has(row.dateKey)) continue;
    lastGoalKcal = goal.kcal;
    const margin = (goal.kcal * goal.tolerance) / 100;
    if (row.kcal >= goal.kcal - margin && row.kcal <= goal.kcal + margin)
      daysWithinGoal += 1;
  }

  const weekWeights = input.weights
    .filter((row) => inWindow(row.dateKey, input))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const beforeWeights = input.weights
    .filter((row) => row.dateKey < input.fromKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let weightChange: number | null = null;
  const lastInWeek = weekWeights.at(-1);
  if (lastInWeek) {
    const lastBefore = beforeWeights.at(-1);
    weightChange =
      lastBefore == null
        ? null
        : round(lastInWeek.kg - lastBefore.kg);
  }

  return {
    fromKey: input.fromKey,
    toKey: input.toKey,
    workouts: workoutDays.size,
    volume: round(volume),
    sets,
    prs,
    kcalTotal: kcalRecordedDays > 0 ? round(kcalTotal) : null,
    kcalRecordedDays,
    kcalAvg:
      kcalRecordedDays > 0 ? round(kcalTotal / kcalRecordedDays) : null,
    daysWithinGoal,
    daysCompleted: [...completed].filter((day) => inWindow(day, input)).length,
    goalKcal: lastGoalKcal,
    weightChange,
  };
}
