"use client";
import {
  dayResult,
  goalForDate,
  nutritionTotal,
  periodDates,
} from "@/lib/nutrition";
import { fmt } from "./format";
import type { CalorieData } from "./entry-draft";

export function OverviewTab({
  data,
  date,
  today,
  period,
  onPeriod,
  onSelectDay,
}: {
  data: CalorieData;
  date: string;
  today: string;
  period: "day" | "week" | "month";
  onPeriod: (period: "day" | "week" | "month") => void;
  onSelectDay: (day: string) => void;
}) {
  const dates = periodDates(date, period).filter((d) => d <= today);
  const summary = dates.map((day) => {
    const rows = data.entries.filter((e) => e.date === day);
    const kcal = nutritionTotal(rows).totals.kcal;
    const target = goalForDate(data.goals, day);
    const closed = data.days.some((d) => d.date === day && d.completed);
    return {
      day,
      kcal,
      target,
      closed,
      hasEntries: rows.length > 0,
      result: dayResult(kcal, target, closed, rows.length > 0),
    };
  });
  const within = summary.filter((d) => d.result === "Dentro da meta").length;
  const closed = summary.filter((d) => d.closed && d.hasEntries).length;
  const recorded = summary.filter((d) => d.hasEntries).length;
  const totalKcal = summary.reduce((sum, d) => sum + d.kcal, 0);
  return (
    <>
      <div className="flex gap-2">
        {(
          [
            ["day", "Dia"],
            ["week", "Semana"],
            ["month", "Mês"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={
              period === value ? "btn-primary flex-1" : "btn-ghost flex-1"
            }
            aria-pressed={period === value}
            onClick={() => onPeriod(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <section aria-label="Resumo do período">
        <p className="text-sm text-zinc-500">
          {dates[0]} — {dates.at(-1)}
        </p>
        <p className="my-3 text-4xl font-semibold">
          {within}{" "}
          <span className="text-base font-normal text-zinc-500">
            dias dentro da meta
          </span>
        </p>
        <p className="text-sm">
          {closed} dias concluídos · {recorded} com registos ·{" "}
          {dates.length - recorded} sem registos
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          {fmt(totalKcal)} kcal registadas · média de{" "}
          {fmt(recorded ? totalKcal / recorded : 0)} kcal por dia com registos
          (pode ser parcial)
        </p>
        <progress
          aria-label="Dias dentro da meta"
          className="nutrition-progress mt-3 h-2 w-full"
          max={Math.max(dates.length, 1)}
          value={within}
        />
      </section>
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {summary.map((day) => (
          <button
            key={day.day}
            className="flex w-full flex-col gap-2 py-3 text-left"
            onClick={() => onSelectDay(day.day)}
          >
            <span className="flex justify-between gap-3 text-sm">
              <span>
                {day.day.slice(8)}/{day.day.slice(5, 7)} · {day.result}
              </span>
              <span>{fmt(day.kcal)} kcal</span>
            </span>
            <progress
              aria-label={`Consumo em ${day.day}`}
              className="nutrition-progress h-1.5 w-full"
              max={day.target?.kcal ?? Math.max(day.kcal, 1)}
              value={Math.min(day.kcal, day.target?.kcal ?? day.kcal)}
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Apenas dias concluídos com meta definida podem contar como cumpridos. A
        margem é configurada por ti. Dias futuros não entram nos marcos.
      </p>
    </>
  );
}
