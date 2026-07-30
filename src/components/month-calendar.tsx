import Link from "next/link";
import type { MonthCalendarData, MonthCalendarDay } from "@/lib/month-calendar";
import { dateFromKey } from "@/lib/workout-calendar";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const titleFormatter = new Intl.DateTimeFormat("pt-PT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayFormatter = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function workoutsHref(params: {
  date?: string;
  month?: string;
  user?: number;
}): string {
  const search = new URLSearchParams();
  if (params.date) search.set("date", params.date);
  if (params.month) search.set("month", params.month);
  if (params.user != null) search.set("user", String(params.user));
  const query = search.toString();
  return query ? `/workouts?${query}` : "/workouts";
}

function dayLabel(day: MonthCalendarDay, planLabel?: string): string {
  const parts = [
    `${day.workoutCount} ${day.workoutCount === 1 ? "treino" : "treinos"}`,
  ];
  if (day.plannedCount > 0) {
    parts.push(
      planLabel
        ? `${day.plannedCount === 1 ? "planeado" : "planeados"}: ${planLabel}`
        : `${day.plannedCount} ${day.plannedCount === 1 ? "plano" : "planos"}`,
    );
  }
  return `${dayFormatter.format(dateFromKey(day.date))}: ${parts.join(", ")}`;
}

function dayClasses(day: MonthCalendarDay, isSelected: boolean): string {
  const classes = [
    "relative flex aspect-square items-center justify-center rounded-lg text-sm",
  ];
  if (day.workoutCount > 0) {
    classes.push("bg-indigo-600 font-medium text-white dark:bg-indigo-500");
  } else if (day.plannedCount > 0) {
    classes.push(
      "border border-dashed border-indigo-400 text-indigo-700 dark:border-indigo-500 dark:text-indigo-300",
    );
  } else {
    classes.push(
      "text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10",
    );
  }
  if (isSelected) {
    classes.push("ring-2 ring-indigo-500 dark:ring-indigo-300");
  } else if (day.isToday) {
    classes.push("ring-2 ring-indigo-300 dark:ring-indigo-700");
  }
  return classes.join(" ");
}

export function MonthCalendar({
  calendar,
  selectedDate,
  viewedUserId,
  planLabels = {},
}: {
  calendar: MonthCalendarData;
  selectedDate: string | null;
  viewedUserId?: number;
  /** Date key → what that day's plan trains, for the cell's label. */
  planLabels?: Record<string, string>;
}) {
  const formatted = titleFormatter.format(dateFromKey(`${calendar.month}-01`));
  const title = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <section className="card" aria-label={`Calendário de ${title}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={workoutsHref({
            month: calendar.previousMonth,
            user: viewedUserId,
          })}
          aria-label="Mês anterior"
          className="rounded-lg p-2 text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
        >
          ‹
        </Link>
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={workoutsHref({ month: calendar.nextMonth, user: viewedUserId })}
          aria-label="Mês seguinte"
          className="rounded-lg p-2 text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
        >
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="text-center text-[10px] font-medium text-zinc-400 dark:text-zinc-500"
            aria-hidden="true"
          >
            {label}
          </span>
        ))}
        {calendar.weeks.flat().map((day) => {
          if (!day.inMonth) {
            return (
              <span
                key={day.date}
                className="flex aspect-square items-center justify-center text-sm text-zinc-300 dark:text-zinc-700"
                aria-hidden="true"
              >
                {day.dayOfMonth}
              </span>
            );
          }
          const isSelected = day.date === selectedDate;
          return (
            <Link
              key={day.date}
              href={workoutsHref({
                date: isSelected ? undefined : day.date,
                month: calendar.month,
                user: viewedUserId,
              })}
              className={dayClasses(day, isSelected)}
              aria-label={dayLabel(day, planLabels[day.date])}
              title={planLabels[day.date]}
              aria-current={isSelected ? "date" : undefined}
              data-month-date={day.date}
              data-workouts={day.workoutCount}
              data-planned={day.plannedCount}
            >
              {day.dayOfMonth}
              {day.plannedCount > 0 && day.workoutCount > 0 && (
                <span
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-white/80"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-indigo-600 dark:bg-indigo-500" />
          Treinado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-dashed border-indigo-400 dark:border-indigo-500" />
          Planeado
        </span>
      </div>
    </section>
  );
}
