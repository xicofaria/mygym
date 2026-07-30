const DAY_MS = 24 * 60 * 60 * 1000;

export const WORKOUT_CALENDAR_WEEKS = 52;

export type WorkoutCalendarDay = {
  date: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
};

export type WorkoutCalendarWeek = {
  startDate: string;
  monthStart: string | null;
  days: WorkoutCalendarDay[];
};

export type WorkoutCalendarData = {
  startDate: string;
  endDate: string;
  totalWorkouts: number;
  activeDays: number;
  maxCount: number;
  weeks: WorkoutCalendarWeek[];
};

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

export function readDateKey(
  value: string | string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isDateKey(candidate) ? candidate : null;
}

export function dateFromKey(value: string): Date {
  if (!isDateKey(value)) throw new RangeError(`Data inválida: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function startOfUtcWeek(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

export function addUtcDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * DAY_MS);
}

function intensityFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  return Math.min(count, 4) as 1 | 2 | 3 | 4;
}

export function buildWorkoutCalendar(
  workoutDates: readonly Date[],
  today: Date = new Date(),
  weeks = WORKOUT_CALENDAR_WEEKS,
): WorkoutCalendarData {
  if (!Number.isSafeInteger(weeks) || weeks < 1 || weeks > 104) {
    throw new RangeError("O calendário deve ter entre 1 e 104 semanas.");
  }
  if (Number.isNaN(today.getTime())) throw new RangeError("Data atual inválida.");

  const todayKey = dateKey(today);
  const currentWeekStart = startOfUtcWeek(today);
  const firstWeekStart = addUtcDays(currentWeekStart, -(weeks - 1) * 7);
  const counts = new Map<string, number>();

  for (const workoutDate of workoutDates) {
    if (Number.isNaN(workoutDate.getTime())) continue;
    const key = dateKey(workoutDate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let totalWorkouts = 0;
  let activeDays = 0;
  let maxCount = 0;
  const calendarWeeks: WorkoutCalendarWeek[] = [];

  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const weekStart = addUtcDays(firstWeekStart, weekIndex * 7);
    const days: WorkoutCalendarDay[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const day = addUtcDays(weekStart, dayIndex);
      const key = dateKey(day);
      const isFuture = key > todayKey;
      const count = isFuture ? 0 : (counts.get(key) ?? 0);
      if (count > 0) {
        activeDays += 1;
        totalWorkouts += count;
        maxCount = Math.max(maxCount, count);
      }
      days.push({
        date: key,
        count,
        intensity: intensityFor(count),
        isFuture,
      });
    }

    const firstOfMonth = days.find((day) => day.date.endsWith("-01"));
    calendarWeeks.push({
      startDate: dateKey(weekStart),
      monthStart:
        weekIndex === 0 ? days[0]?.date ?? null : (firstOfMonth?.date ?? null),
      days,
    });
  }

  return {
    startDate: dateKey(firstWeekStart),
    endDate: todayKey,
    totalWorkouts,
    activeDays,
    maxCount,
    weeks: calendarWeeks,
  };
}
