"use client";

import { useState, useTransition } from "react";
import { createWorkout } from "@/app/(app)/workouts/actions";
import { toDateInputValue } from "@/lib/format";

type Ex = { id: number; name: string };
type Row = { exerciseId: number; reps: string; weight: string };

export function WorkoutForm({
  exercises,
  initialRows,
}: {
  exercises: Ex[];
  initialRows?: { exerciseId: number }[];
}) {
  const firstId = exercises[0]?.id ?? 0;
  const [date, setDate] = useState(toDateInputValue());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>(
    initialRows && initialRows.length > 0
      ? initialRows.map((r) => ({ exerciseId: r.exerciseId, reps: "", weight: "" }))
      : [{ exerciseId: firstId, reps: "", weight: "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addSet() {
    setRows((rs) => {
      const last = rs[rs.length - 1];
      return [...rs, last ? { ...last } : { exerciseId: firstId, reps: "", weight: "" }];
    });
  }
  function removeRow(i: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const entries = rows
      .map((r) => ({
        exerciseId: Number(r.exerciseId),
        reps: Number(r.reps),
        weight: Number(r.weight),
      }))
      .filter(
        (r) =>
          r.exerciseId > 0 &&
          Number.isFinite(r.reps) &&
          r.reps > 0 &&
          Number.isFinite(r.weight) &&
          r.weight >= 0,
      );

    if (entries.length === 0) {
      setError("Adiciona pelo menos uma série com repetições e peso.");
      return;
    }

    start(async () => {
      const res = await createWorkout({
        date,
        notes: notes || undefined,
        entries,
      });
      if (res?.error) setError(res.error);
      // On success the server action redirects to /workouts.
    });
  }

  if (exercises.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Adiciona primeiro um exercício ao catálogo e depois regista aqui as
        tuas séries.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Data</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Notas (opcional)</label>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Como correu?"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="card flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <select
                className="input"
                value={row.exerciseId}
                onChange={(e) =>
                  update(i, { exerciseId: Number(e.target.value) })
                }
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remover série"
                disabled={rows.length === 1}
                className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-black/5 hover:text-red-600 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-red-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Repetições</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="input"
                  value={row.reps}
                  onChange={(e) => update(i, { reps: e.target.value })}
                  placeholder="12"
                />
              </div>
              <div>
                <label className="label">Peso (kg)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  className="input"
                  value={row.weight}
                  onChange={(e) => update(i, { weight: e.target.value })}
                  placeholder="24"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addSet} className="btn-ghost w-full">
        + Adicionar série
      </button>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary sticky bottom-24 w-full shadow-lg"
        disabled={pending}
      >
        {pending ? "A guardar…" : "Guardar treino"}
      </button>
    </form>
  );
}
