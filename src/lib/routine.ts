import { monthDateKeys } from "./month-calendar";
import { normalizeGroupNames } from "./muscle-groups";
import { dateFromKey, dateKey } from "./workout-calendar";

/**
 * The weekly split: which muscle groups belong to each weekday, and how it
 * gets materialized into planned workouts for a given month.
 */

export const WEEKDAYS = [
  { weekday: 1, short: "Seg", long: "Segunda-feira" },
  { weekday: 2, short: "Ter", long: "Terça-feira" },
  { weekday: 3, short: "Qua", long: "Quarta-feira" },
  { weekday: 4, short: "Qui", long: "Quinta-feira" },
  { weekday: 5, short: "Sex", long: "Sexta-feira" },
  { weekday: 6, short: "Sáb", long: "Sábado" },
  { weekday: 7, short: "Dom", long: "Domingo" },
] as const;

export type RoutineDay = { weekday: number; groups: string[] };

export function isWeekday(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 7;
}

/** ISO weekday of a UTC date: 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

export function routineDayGroups(
  routine: readonly RoutineDay[],
  weekday: number,
): string[] {
  return routine.find((day) => day.weekday === weekday)?.groups ?? [];
}

export function isRestDay(
  routine: readonly RoutineDay[],
  weekday: number,
): boolean {
  return routineDayGroups(routine, weekday).length === 0;
}

/**
 * The planned workouts an "apply routine to this month" run should create:
 * every day from today onward whose weekday has groups and that has no plan
 * yet. Existing plans and past days are never touched, so applying twice is
 * safe and applying never destroys anything.
 */
export function planRoutineApplication({
  month,
  routine,
  existingPlanDates,
  today = new Date(),
}: {
  month: string;
  routine: readonly RoutineDay[];
  existingPlanDates: readonly string[];
  today?: Date;
}): { date: string; groups: string[] }[] {
  const todayKey = dateKey(today);
  const taken = new Set(existingPlanDates);

  return monthDateKeys(month)
    .filter((key) => key >= todayKey && !taken.has(key))
    .map((key) => ({
      date: key,
      groups: normalizeGroupNames(
        routineDayGroups(routine, weekdayOf(dateFromKey(key))),
      ),
    }))
    .filter((entry) => entry.groups.length > 0);
}
