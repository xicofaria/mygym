"use client";
import {
  meals,
  nutrientLabels,
  nutritionTotal,
  scaleNutrition,
  type FoodEntry,
} from "@/lib/nutrition";
import { fmt } from "./format";

export function MealList({
  entries,
  pending,
  onEdit,
  onDelete,
}: {
  entries: FoodEntry[];
  pending: boolean;
  onEdit: (entry: FoodEntry, trigger: HTMLButtonElement) => void;
  onDelete: (entry: FoodEntry) => void;
}) {
  return (
    <section aria-label="Refeições do dia" className="flex flex-col gap-4">
      {!entries.length && (
        <p className="py-4 text-sm text-zinc-500">
          Ainda não registaste alimentos neste dia.
        </p>
      )}
      {meals.map((m) => {
        const rows = entries.filter((e) => e.meal === m);
        if (!rows.length) return null;
        return (
          <div key={m}>
            <h2 className="mb-2 flex justify-between font-semibold">
              {m}
              <span>{fmt(nutritionTotal(rows).totals.kcal)} kcal</span>
            </h2>
            {rows.map((entry) => (
              <article
                aria-label={entry.snapshot.name}
                key={entry.id}
                className="border-t border-black/5 py-3 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.snapshot.name}</p>
                    <p className="text-xs text-zinc-500">
                      {fmt(entry.quantity)} {entry.snapshot.unit} ·{" "}
                      {entry.snapshot.brand}{" "}
                      {entry.snapshot.source === "estimate-ai"
                        ? "· Estimativa IA"
                        : ""}
                    </p>
                    {entry.snapshot.details.pieceQuantity && (
                      <p className="text-xs text-zinc-500">
                        ≈{" "}
                        {fmt(
                          entry.quantity /
                            entry.snapshot.details.pieceQuantity,
                        )}{" "}
                        unidades
                        {entry.snapshot.details.pieceEstimated
                          ? " (peso médio estimado)"
                          : ""}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-medium">
                    {fmt(
                      scaleNutrition(entry.snapshot.nutrients, entry.quantity)
                        .kcal,
                    )}{" "}
                    kcal
                  </span>
                </div>
                <details className="mt-2 text-xs text-zinc-500">
                  <summary className="cursor-pointer">
                    Valores nutricionais
                  </summary>
                  <p className="mt-1">
                    {Object.entries(
                      scaleNutrition(entry.snapshot.nutrients, entry.quantity),
                    )
                      .map(
                        ([k, v]) =>
                          `${nutrientLabels[k as keyof typeof nutrientLabels]}: ${v === null ? "desconhecido" : fmt(v) + (k === "kcal" ? "" : " g")}`,
                      )
                      .join(" · ")}
                  </p>
                </details>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={pending}
                    onClick={(event) => onEdit(entry, event.currentTarget)}
                  >
                    Editar consumo
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={pending}
                    onClick={() => onDelete(entry)}
                  >
                    Eliminar consumo
                  </button>
                </div>
              </article>
            ))}
          </div>
        );
      })}
    </section>
  );
}
