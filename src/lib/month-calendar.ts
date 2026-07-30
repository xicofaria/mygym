import {
  addUtcDays,
  dateKey,
  dateFromKey,
  startOfUtcWeek,
} from "./workout-calendar";
import { lisbonDateKey } from "./format";

/**
 * Pure month-grid math for the monthly calendar on /workouts.
 * All dates use the same UTC-midnight convention as workout-calendar.ts.
 */

export type MonthCalendarDay = {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  workoutCount: number;
  plannedCount: number;
};

export type MonthCalendarData = {
  month: string;
  previousMonth: string;
  nextMonth: string;
  weeks: MonthCalendarDay[][];
};

/** Keeps every planned-session label for a day instead of overwriting it. */
export function aggregatePlanLabels(
  entries: readonly { date: string; label: string }[],
): Record<string, string> {
  const labels = new Map<string, string[]>();
  for (const entry of entries) {
    const dayLabels = labels.get(entry.date);
    if (dayLabels) dayLabels.push(entry.label);
    else labels.set(entry.date, [entry.label]);
  }
  return Object.fromEntries(
    [...labels].map(([date, dayLabels]) => [date, dayLabels.join(" + ")]),
  );
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function readMonthKey(
  value: string | string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isMonthKey(candidate) ? candidate : null;
}

export function monthKeyOf(date: Date): string {
  return dateKey(date).slice(0, 7);
}

function monthStart(monthKey: string): Date {
  if (!isMonthKey(monthKey)) throw new RangeError(`Mês inválido: ${monthKey}`);
  return dateFromKey(`${monthKey}-01`);
}

function shiftMonth(monthKey: string, amount: number): string {
  const start = monthStart(monthKey);
  return monthKeyOf(
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + amount, 1)),
  );
}

/** The Monday–Sunday span the month grid renders; `to` is exclusive. */
export function monthGridRange(monthKey: string): { from: string; to: string } {
  const start = monthStart(monthKey);
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );
  return {
    from: dateKey(startOfUtcWeek(start)),
    to: dateKey(addUtcDays(startOfUtcWeek(end), 7)),
  };
}

/** Every day in the month, as `YYYY-MM-DD` keys, in order. */
export function monthDateKeys(monthKey: string): string[] {
  const start = monthStart(monthKey);
  const keys: string[] = [];
  for (
    let day = start;
    monthKeyOf(day) === monthKey;
    day = addUtcDays(day, 1)
  ) {
    keys.push(dateKey(day));
  }
  return keys;
}

function countByDay(dates: readonly Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) {
    if (Number.isNaN(date.getTime())) continue;
    const key = dateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function buildMonthCalendar(
  monthKey: string,
  workoutDates: readonly Date[],
  plannedDates: readonly Date[],
  today: Date = new Date(),
): MonthCalendarData {
  if (Number.isNaN(today.getTime())) throw new RangeError("Data atual inválida.");

  const range = monthGridRange(monthKey);
  const gridStart = dateFromKey(range.from);
  const gridEnd = dateFromKey(range.to);
  const todayKey = lisbonDateKey(today);
  const workoutCounts = countByDay(workoutDates);
  const plannedCounts = countByDay(plannedDates);

  const weeks: MonthCalendarDay[][] = [];
  for (
    let weekStart = gridStart;
    weekStart < gridEnd;
    weekStart = addUtcDays(weekStart, 7)
  ) {
    const days: MonthCalendarDay[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const day = addUtcDays(weekStart, dayIndex);
      const key = dateKey(day);
      days.push({
        date: key,
        dayOfMonth: day.getUTCDate(),
        inMonth: key.startsWith(monthKey),
        isToday: key === todayKey,
        isFuture: key > todayKey,
        workoutCount: workoutCounts.get(key) ?? 0,
        plannedCount: plannedCounts.get(key) ?? 0,
      });
    }
    weeks.push(days);
  }

  return {
    month: monthKey,
    previousMonth: shiftMonth(monthKey, -1),
    nextMonth: shiftMonth(monthKey, 1),
    weeks,
  };
}
