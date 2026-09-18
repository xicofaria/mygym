"use client";
import type { FoodEntry } from "@/lib/nutrition";
import { fmt } from "./format";

export function RepeatRecent({
  recent,
  pending,
  guard,
  onRepeat,
}: {
  recent: FoodEntry[];
  pending: boolean;
  /** False keeps the current draft: repeating would overwrite fields in progress. */
  guard: () => boolean;
  onRepeat: (entry: FoodEntry, trigger: HTMLButtonElement) => void;
}) {
  if (!recent.length) return null;
  return (
    <details className="rounded-xl border border-black/10 p-3 dark:border-white/10">
      <summary className="min-h-11 cursor-pointer font-medium">
        Repetir um consumo recente
      </summary>
      <div className="flex flex-col gap-2">
        {recent.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="btn-ghost text-left"
            disabled={pending}
            onClick={(event) => {
              if (!guard()) return;
              onRepeat(entry, event.currentTarget);
            }}
          >
            Repetir {entry.snapshot.name} · {fmt(entry.quantity)}{" "}
            {entry.snapshot.unit} · {entry.date}
          </button>
        ))}
      </div>
    </details>
  );
}
