"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createWorkout,
  updateWorkout,
} from "@/app/(app)/workouts/actions";
import { toDateInputValue } from "@/lib/format";
import {
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
} from "@/lib/local-draft";
import type { LastPerformance } from "@/lib/queries";

type Ex = { id: number; name: string };
type Row = { exerciseId: number; reps: string; weight: string };
type InitialRow = { exerciseId: number; reps?: number; weight?: number };
type WorkoutDraft = { date: string; notes: string; rows: Row[] };

function isWorkoutDraft(value: unknown): value is WorkoutDraft {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<WorkoutDraft>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.notes === "string" &&
    Array.isArray(candidate.rows) &&
    candidate.rows.length > 0 &&
    candidate.rows.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        typeof row.exerciseId === "number" &&
        typeof row.reps === "string" &&
        typeof row.weight === "string",
    )
  );
}

export function WorkoutForm({
  exercises,
  initialRows,
  initialDate,
  initialNotes,
  lastPerformance = {},
  workoutId,
}: {
  exercises: Ex[];
  initialRows?: InitialRow[];
  initialDate?: string;
  initialNotes?: string;
  lastPerformance?: LastPerformance;
  workoutId?: number;
}) {
  const firstId = exercises[0]?.id ?? 0;
  const [date, setDate] = useState(initialDate ?? toDateInputValue());
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [rows, setRows] = useState<Row[]>(
    initialRows && initialRows.length > 0
      ? initialRows.map((row) => ({
          exerciseId: row.exerciseId,
          reps: row.reps == null ? "" : String(row.reps),
          weight: row.weight == null ? "" : String(row.weight),
        }))
      : [{ exerciseId: firstId, reps: "", weight: "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [draftReady, setDraftReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const draftKey = `gym-tracker:workout-draft:${workoutId ?? "new"}`;

  useEffect(() => {
    const draft = readLocalDraft(localStorage, draftKey, isWorkoutDraft);
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (draft) {
        setDate(draft.date);
        setNotes(draft.notes);
        setRows(draft.rows);
        setRestoredDraft(true);
        setDirty(true);
      }
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || !dirty) return;
    writeLocalDraft(localStorage, draftKey, { date, notes, rows });
  }, [date, dirty, draftKey, draftReady, notes, rows]);

  function update(i: number, patch: Partial<Row>) {
    setDirty(true);
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addSet() {
    setDirty(true);
    setRows((rs) => {
      const last = rs[rs.length - 1];
      return [...rs, last ? { ...last } : { exerciseId: firstId, reps: "", weight: "" }];
    });
  }
  function duplicateRow(i: number) {
    setDirty(true);
    setRows((current) => [
      ...current.slice(0, i + 1),
      { ...current[i] },
      ...current.slice(i + 1),
    ]);
  }
  function removeRow(i: number) {
    setDirty(true);
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

    const draft = { date, notes, rows };
    removeLocalDraft(localStorage, draftKey);

    start(async () => {
      try {
        const input = {
          date,
          notes: notes || undefined,
          entries,
        };
        const res =
          workoutId == null
            ? await createWorkout(input)
            : await updateWorkout(workoutId, input);
        if (res?.error) {
          writeLocalDraft(localStorage, draftKey, draft);
          setError(res.error);
        }
        // On success the server action redirects to /workouts, and the draft
        // stays cleared. A network failure restores it below.
      } catch {
        writeLocalDraft(localStorage, draftKey, draft);
        setError(
          "Sem ligação ao servidor. O rascunho ficou guardado neste dispositivo.",
        );
      }
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
            onChange={(e) => {
              setDate(e.target.value);
              setDirty(true);
            }}
            required
          />
        </div>
        <div>
          <label className="label">Notas (opcional)</label>
          <input
            className="input"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
            placeholder="Como correu?"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="card flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <select
                  aria-label={`Exercício da série ${i + 1}`}
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
                {lastPerformance[row.exerciseId] && (
                  <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    Última: {lastPerformance[row.exerciseId].summary}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => duplicateRow(i)}
                aria-label="Duplicar série"
                title="Duplicar série"
                className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-black/5 hover:text-indigo-600 dark:hover:bg-white/10 dark:hover:text-indigo-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="8" y="8" width="11" height="11" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
              </button>
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
                <label className="label" htmlFor={`reps-${i}`}>
                  Repetições
                </label>
                <input
                  id={`reps-${i}`}
                  aria-label={`Repetições da série ${i + 1}`}
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
                <label className="label" htmlFor={`weight-${i}`}>
                  Peso (kg)
                </label>
                <input
                  id={`weight-${i}`}
                  aria-label={`Peso (kg) da série ${i + 1}`}
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

      {restoredDraft && !error && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          Recuperámos o rascunho guardado neste dispositivo.
        </p>
      )}

      <button
        type="submit"
        className="btn-primary sticky bottom-24 w-full shadow-lg"
        disabled={pending}
      >
        {pending
          ? "A guardar…"
          : workoutId == null
            ? "Guardar treino"
            : "Guardar alterações"}
      </button>
    </form>
  );
}
