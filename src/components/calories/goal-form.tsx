"use client";
import { useState, type RefObject } from "react";
import { parseWeight } from "@/lib/decimal";
import type { CalorieGoal } from "@/lib/nutrition";
import { fmt } from "./format";

export function GoalForm({
  today,
  currentGoal,
  openGoal,
  pending,
  goalDetailsRef,
  goalFieldRef,
  onSave,
}: {
  today: string;
  currentGoal: CalorieGoal | null;
  openGoal: boolean;
  pending: boolean;
  goalDetailsRef: RefObject<HTMLDetailsElement | null>;
  goalFieldRef: RefObject<HTMLInputElement | null>;
  onSave: (kcal: number, tolerance: number) => void;
}) {
  const [goalInput, setGoalInput] = useState("");
  const [tolerance, setTolerance] = useState("10");
  return (
    <details
      id="calorie-goal"
      ref={goalDetailsRef}
      open={openGoal || undefined}
      className="border-t border-black/10 pt-4 dark:border-white/10"
    >
      <summary className="cursor-pointer font-semibold">
        Definir meta diária
      </summary>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(parseWeight(goalInput), parseWeight(tolerance));
        }}
      >
        <p className="text-xs text-zinc-500">
          A alteração aplica-se a partir de hoje ({today}); dias anteriores
          mantêm as metas históricas.{" "}
          {currentGoal ? `Meta atual: ${fmt(currentGoal.kcal)} kcal.` : ""}
        </p>
        <label className="label">
          Meta (kcal)
          <input
            ref={goalFieldRef}
            autoFocus={openGoal}
            className="input"
            inputMode="decimal"
            required
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="Definida por ti"
          />
        </label>
        <label className="label">
          Margem da meta (%)
          <input
            className="input"
            inputMode="decimal"
            required
            value={tolerance}
            onChange={(e) => setTolerance(e.target.value)}
          />
        </label>
        <button className="btn-primary" disabled={pending}>
          Guardar meta
        </button>
      </form>
    </details>
  );
}
