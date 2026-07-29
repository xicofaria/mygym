"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type {
  WorkoutCalendarData,
  WorkoutCalendarDay,
} from "@/lib/workout-calendar";
import { dateFromKey } from "@/lib/workout-calendar";

const DAY_LABELS = ["Seg", "", "Qua", "", "Sex", "", ""];
const INTENSITY_CLASSES = [
  "bg-zinc-200/80 dark:bg-zinc-800",
  "bg-indigo-200 dark:bg-indigo-900",
  "bg-indigo-400 dark:bg-indigo-700",
  "bg-indigo-600 dark:bg-indigo-500",
  "bg-indigo-800 dark:bg-indigo-300",
] as const;

const dayFormatter = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("pt-PT", {
  month: "short",
  timeZone: "UTC",
});

function workoutCountLabel(count: number): string {
  return `${count} ${count === 1 ? "treino" : "treinos"}`;
}

function dayLabel(day: WorkoutCalendarDay): string {
  return `${dayFormatter.format(dateFromKey(day.date))}: ${workoutCountLabel(day.count)}`;
}

function workoutHref(date: string, viewedUserId?: number): string {
  const params = new URLSearchParams({ date });
  if (viewedUserId != null) params.set("user", String(viewedUserId));
  return `/workouts?${params.toString()}`;
}

export function WorkoutCalendar({
  calendar,
  viewedUserId,
}: {
  calendar: WorkoutCalendarData;
  viewedUserId?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollLeft = container.scrollWidth;
  }, []);

  return (
    <section className="card" aria-labelledby="workout-calendar-title">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="workout-calendar-title" className="text-sm font-semibold">
            Calendário de treinos
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Últimas 52 semanas
          </p>
        </div>
        <p className="text-right text-xs text-zinc-500 dark:text-zinc-400">
          <strong className="block text-sm text-zinc-900 dark:text-zinc-100">
            {workoutCountLabel(calendar.totalWorkouts)}
          </strong>
          {calendar.activeDays} {calendar.activeDays === 1 ? "dia ativo" : "dias ativos"}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto pb-2 [scrollbar-color:var(--color-zinc-300)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:var(--color-zinc-700)_transparent]"
        role="region"
        aria-label="Mapa de atividade dos últimos 12 meses"
        tabIndex={0}
      >
        <div className="min-w-max">
          <div className="ml-8 flex h-4 gap-1" aria-hidden="true">
            {calendar.weeks.map((week) => (
              <div key={week.startDate} className="relative w-3 shrink-0">
                {week.monthStart && (
                  <span className="absolute left-0 whitespace-nowrap text-[10px] capitalize text-zinc-400 dark:text-zinc-500">
                    {monthFormatter.format(dateFromKey(week.monthStart))}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-start">
            <div
              className="sticky left-0 z-10 mr-2 grid grid-rows-7 gap-1 bg-white text-[9px] leading-3 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
              aria-hidden="true"
            >
              {DAY_LABELS.map((label, index) => (
                <span key={index} className="h-3 w-6">
                  {label}
                </span>
              ))}
            </div>

            <div className="flex gap-1">
              {calendar.weeks.map((week) => (
                <div key={week.startDate} className="grid grid-rows-7 gap-1">
                  {week.days.map((day) => {
                    const className = `h-3 w-3 rounded-[3px] ${
                      day.isFuture
                        ? "bg-transparent ring-1 ring-inset ring-zinc-100 dark:ring-zinc-900"
                        : INTENSITY_CLASSES[day.intensity]
                    }`;

                    return day.count > 0 ? (
                      <Link
                        key={day.date}
                        href={workoutHref(day.date, viewedUserId)}
                        className={`${className} outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:ring-offset-zinc-900`}
                        aria-label={dayLabel(day)}
                        title={dayLabel(day)}
                        data-workout-date={day.date}
                        data-count={day.count}
                      />
                    ) : (
                      <span
                        key={day.date}
                        className={className}
                        title={day.isFuture ? undefined : dayLabel(day)}
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
        <span>Seleciona um dia colorido para ver os treinos.</span>
        <div className="flex items-center gap-1.5" aria-label="Escala de intensidade">
          <span>Menos</span>
          {INTENSITY_CLASSES.map((className, index) => (
            <span
              key={className}
              className={`h-3 w-3 rounded-[3px] ${className}`}
              title={
                index === 4 ? "4 ou mais treinos" : workoutCountLabel(index)
              }
              aria-hidden="true"
            />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </section>
  );
}
