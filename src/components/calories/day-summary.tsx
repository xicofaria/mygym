"use client";
import type { RefObject } from "react";
import {
  dayResult,
  nutrientLabels,
  nutritionTotal,
  type CalorieGoal,
} from "@/lib/nutrition";
import { fmt } from "./format";

type Totals = ReturnType<typeof nutritionTotal>["totals"];

export function DaySummary({
  date,
  today,
  totals,
  incomplete,
  goal,
  entryCount,
  complete,
  pending,
  goalDetailsRef,
  goalFieldRef,
  onToggleComplete,
}: {
  date: string;
  today: string;
  totals: Totals;
  incomplete: string[];
  goal: CalorieGoal | null;
  entryCount: number;
  complete: boolean;
  pending: boolean;
  goalDetailsRef: RefObject<HTMLDetailsElement | null>;
  goalFieldRef: RefObject<HTMLInputElement | null>;
  onToggleComplete: () => void;
}) {
  return (
    <section
      aria-label="Resumo do dia"
      className="border-b border-black/10 pb-5 dark:border-white/10"
    >
      <p className="text-sm text-zinc-500">
        {date === today ? "Hoje" : date} ·{" "}
        {dayResult(totals.kcal, goal, complete, entryCount > 0)}
      </p>
      <p className="my-2">
        <span className="text-5xl font-semibold tracking-tight tabular-nums">
          {fmt(totals.kcal)}
        </span>{" "}
        <span className="text-zinc-500">
          kcal {goal ? "/ " + fmt(goal.kcal) : ""}
        </span>
      </p>
      {goal ? (
        <>
          <progress
            aria-label="Progresso calórico do dia"
            className="nutrition-progress h-2 w-full"
            max={goal.kcal}
            value={Math.min(totals.kcal, goal.kcal)}
          />
          <p className="mt-2 text-xs text-zinc-500">
            {totals.kcal <= goal.kcal
              ? `${fmt(goal.kcal - totals.kcal)} kcal até à meta`
              : `${fmt(totals.kcal - goal.kcal)} kcal acima da meta`}{" "}
            · intervalo ±{goal.tolerance}%
          </p>
        </>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-zinc-500">
            Ainda não definiste uma meta. Podes continuar a registar alimentos.
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (goalDetailsRef.current) goalDetailsRef.current.open = true;
              goalFieldRef.current?.focus();
              goalFieldRef.current?.scrollIntoView({ block: "center" });
            }}
          >
            Definir a minha meta
          </button>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(["protein", "carbs", "fat"] as const).map((key) => (
          <div key={key}>
            <p className="text-xs text-zinc-500">{nutrientLabels[key]}</p>
            <p className="font-semibold">
              {fmt(totals[key])} g{incomplete.includes(key) ? "*" : ""}
            </p>
          </div>
        ))}
      </div>
      {incomplete.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          * Total parcial: há alimentos com nutrientes desconhecidos.
        </p>
      )}
      <div className="mt-4 flex flex-col items-start gap-2">
        <p role="status" className="text-sm">
          {complete ? "Dia concluído" : "Registo do dia em aberto"}
        </p>
        <button
          type="button"
          className="btn-ghost"
          disabled={pending || !entryCount}
          onClick={onToggleComplete}
        >
          {complete ? "Reabrir dia" : "Concluir registo do dia"}
        </button>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Conclui quando tiveres registado todas as refeições. Alterar consumos
          reabre o dia. Comer menos não é automaticamente cumprir a meta.
        </p>
      </div>
    </section>
  );
}
