"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkout, updateWorkout } from "@/app/(app)/workouts/actions";
import { toDateInputValue } from "@/lib/format";
import {
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
} from "@/lib/local-draft";
import type { LastPerformance } from "@/lib/queries";
import { parseWeight } from "@/lib/decimal";
import { MachinePhotoPicker } from "@/components/machine-photo-picker";
import { ExercisePicker } from "@/components/exercise-picker";
import { RestTimer } from "@/components/rest-timer";
import type { SearchableExercise } from "@/lib/exercise-catalog";

type Ex = SearchableExercise;
type Row = { exerciseId: number; reps: string; weight: string };
type InitialRow = { exerciseId: number; reps?: number; weight?: number };
type WorkoutDraft = { date: string; notes: string; rows: Row[] };

const WORKOUT_DRAFT_PREFIX = "gym-tracker:workout-draft:";
const NAMESPACED_WORKOUT_DRAFT = /^gym-tracker:workout-draft:user-\d+:/;

function removeLegacyWorkoutDrafts(storage: Storage, currentLegacyKey: string) {
  try {
    // Snapshot first: mutating Storage while walking its numeric indexes is
    // inconsistent across browsers and could leave every second key behind.
    for (const key of Object.keys(storage)) {
      if (
        key.startsWith(WORKOUT_DRAFT_PREFIX) &&
        !NAMESPACED_WORKOUT_DRAFT.test(key)
      ) {
        removeLocalDraft(storage, key);
      }
    }
  } catch {
    // Some privacy modes block enumeration.
  } finally {
    // A direct removal still works in some modes that block enumeration.
    removeLocalDraft(storage, currentLegacyKey);
  }
}

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
  userId,
  exercises,
  initialRows,
  initialDate,
  initialNotes,
  draftScope = "",
  lastPerformance = {},
  workoutId,
  plannedWorkoutId,
  favoriteIds = [],
  aiProvider = "openai",
}: {
  userId: number;
  exercises: Ex[];
  initialRows?: InitialRow[];
  initialDate?: string;
  initialNotes?: string;
  /** Distinguishes drafts of forms opened with different prefills, so a draft
   * left on the blank form never overwrites an explicit date or template. */
  draftScope?: string;
  lastPerformance?: LastPerformance;
  workoutId?: number;
  /** Exact plan this new session completes. Never accepted when editing. */
  plannedWorkoutId?: number;
  favoriteIds?: number[];
  aiProvider?: "openai" | "openrouter";
}) {
  const router = useRouter();
  const firstId = exercises[0]?.id ?? 0;
  const [extraExercises, setExtraExercises] = useState<Ex[]>([]);
  const allExercises = useMemo(() => {
    const known = new Set(exercises.map((ex) => ex.id));
    return [...exercises, ...extraExercises.filter((ex) => !known.has(ex.id))];
  }, [exercises, extraExercises]);
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
  const submittingRef = useRef(false);
  const legacyDraftKey =
    `${WORKOUT_DRAFT_PREFIX}${workoutId ?? "new"}` +
    (draftScope ? `:${draftScope}` : "");
  const draftKey =
    `${WORKOUT_DRAFT_PREFIX}user-${userId}:${workoutId ?? "new"}` +
    (draftScope ? `:${draftScope}` : "");

  useEffect(() => {
    // Drafts written before they were scoped to an authenticated account must
    // never be restored: the next person using this browser may be another
    // user. Purge legacy workout drafts without touching account-scoped data.
    removeLegacyWorkoutDrafts(localStorage, legacyDraftKey);
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
  }, [draftKey, legacyDraftKey]);

  useEffect(() => {
    if (!draftReady || !dirty || submittingRef.current) return;
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
      return [
        ...rs,
        last ? { ...last } : { exerciseId: firstId, reps: "", weight: "" },
      ];
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
    const entries = rows.map((r) => ({
      exerciseId: Number(r.exerciseId),
      reps: r.reps.trim() === "" ? Number.NaN : Number(r.reps),
      // `Number("")` is zero; keep an empty weight invalid while still
      // allowing an explicitly entered 0 kg for bodyweight movements.
      weight: parseWeight(r.weight),
    }));

    if (
      entries.length === 0 ||
      entries.every((r) => !Number.isFinite(r.weight))
    ) {
      setError("Adiciona pelo menos uma série com repetições e peso.");
      return;
    }
    const invalidIndex = entries.findIndex(
      (r) =>
        !allExercises.some((ex) => ex.id === r.exerciseId) ||
        !Number.isInteger(r.reps) ||
        r.reps < 1 ||
        r.reps > 1000 ||
        !Number.isFinite(r.weight) ||
        r.weight < 0 ||
        r.weight > 2000,
    );
    if (invalidIndex !== -1) {
      setError(
        `Verifica a série ${invalidIndex + 1}: indica 1 a 1000 repetições e um peso entre 0 e 2000 kg.`,
      );
      return;
    }

    const draft = { date, notes, rows };
    submittingRef.current = true;
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
            ? await createWorkout({
                ...input,
                plannedWorkoutId:
                  plannedWorkoutId != null && date === initialDate
                    ? plannedWorkoutId
                    : undefined,
              })
            : await updateWorkout(workoutId, input);
        if (res?.error) {
          submittingRef.current = false;
          writeLocalDraft(localStorage, draftKey, draft);
          setError(res.error);
          return;
        }
        // A passive draft effect may have raced with the first removal while
        // the action was in flight. Clear once more after the server confirms
        // the write, then navigate from the client.
        removeLocalDraft(localStorage, draftKey);
        submittingRef.current = false;
        router.push("/workouts");
      } catch {
        submittingRef.current = false;
        writeLocalDraft(localStorage, draftKey, draft);
        setError(
          "Sem ligação ao servidor. O rascunho ficou guardado neste dispositivo.",
        );
      }
    });
  }

  if (allExercises.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Adiciona primeiro um exercício ao catálogo e depois regista aqui as tuas
        séries.
      </p>
    );
  }

  const addExerciseRow = (exerciseId: number) => {
    setDirty(true);
    setRows((current) => {
      const empty = current.findIndex(
        (row) => !row.reps.trim() && !row.weight.trim(),
      );
      return empty === -1
        ? [...current, { exerciseId, reps: "", weight: "" }]
        : current.map((row, index) =>
            index === empty ? { ...row, exerciseId } : row,
          );
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="workout-date">
            Data
          </label>
          <input
            id="workout-date"
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
          <label className="label" htmlFor="workout-notes">
            Notas (opcional)
          </label>
          <input
            id="workout-notes"
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

      <MachinePhotoPicker
        provider={aiProvider}
        exercises={allExercises}
        disabled={pending}
        onSelect={addExerciseRow}
        onCreated={(exercise) => {
          setExtraExercises((current) =>
            current.some((ex) => ex.id === exercise.id)
              ? current
              : [...current, exercise],
          );
          addExerciseRow(exercise.id);
        }}
      />

      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Exercícios e séries</h2>
        <span className="text-xs text-zinc-500">
          {rows.length} {rows.length === 1 ? "série" : "séries"}
        </span>
      </div>
      <div className="flex flex-col gap-5">
        {rows
          .reduce<{ exerciseId: number; indices: number[] }[]>(
            (groups, row, index) => {
              const last = groups.at(-1);
              if (last?.exerciseId === row.exerciseId) last.indices.push(index);
              else
                groups.push({ exerciseId: row.exerciseId, indices: [index] });
              return groups;
            },
            [],
          )
          .map((group) => (
            <section
              key={group.indices[0]}
              aria-label={`Grupo de séries ${group.indices[0] + 1}`}
              className="border-t border-black/10 pt-4 dark:border-white/10"
            >
              <ExercisePicker
                exercises={allExercises}
                value={group.exerciseId}
                label={`Exercício da série ${group.indices[0] + 1}`}
                favoriteIds={favoriteIds}
                recentIds={Object.entries(lastPerformance)
                  .sort((a, b) => b[1].date.localeCompare(a[1].date))
                  .map(([id]) => Number(id))}
                onChange={(exerciseId) => {
                  setDirty(true);
                  setRows((current) =>
                    current.map((row, index) =>
                      group.indices.includes(index)
                        ? { ...row, exerciseId }
                        : row,
                    ),
                  );
                }}
              />
              {lastPerformance[group.exerciseId] && (
                <p className="my-2 text-xs text-zinc-500">
                  Última: {lastPerformance[group.exerciseId].summary}
                </p>
              )}
              <div
                className="mt-3 grid grid-cols-[1.75rem_1fr_1fr_2.75rem_2.75rem] items-center gap-2 text-xs text-zinc-500"
                aria-hidden="true"
              >
                <span>#</span>
                <span>Repetições</span>
                <span>Peso (kg)</span>
                <span />
                <span />
              </div>
              {group.indices.map((i) => (
                <div
                  key={i}
                  className="mt-2 grid grid-cols-[1.75rem_1fr_1fr_2.75rem_2.75rem] items-center gap-2"
                >
                  <span className="text-sm tabular-nums text-zinc-500">
                    {i + 1}
                  </span>
                  <input
                    id={`reps-${i}`}
                    aria-label={`Repetições da série ${i + 1}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    className="input min-w-0"
                    value={rows[i].reps}
                    onChange={(e) => update(i, { reps: e.target.value })}
                    placeholder="12"
                  />
                  <input
                    id={`weight-${i}`}
                    aria-label={`Peso (kg) da série ${i + 1}`}
                    type="text"
                    inputMode="decimal"
                    maxLength={16}
                    className="input min-w-0"
                    value={rows[i].weight}
                    onChange={(e) => update(i, { weight: e.target.value })}
                    placeholder="2,8"
                  />
                  <button
                    type="button"
                    onClick={() => duplicateRow(i)}
                    aria-label="Duplicar série"
                    title="Duplicar série"
                    className="min-h-11 rounded-lg text-lg text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-white/5"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label="Remover série"
                    disabled={rows.length === 1}
                    className="min-h-11 rounded-lg text-lg text-zinc-500 hover:text-red-600 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost mt-2"
                onClick={() => duplicateRow(group.indices.at(-1)!)}
              >
                + Série neste exercício
              </button>
            </section>
          ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addSet} className="btn-ghost flex-1">
          + Adicionar série
        </button>
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={() => {
            setDirty(true);
            // Start a new block without altering any existing set.
            const exerciseId =
              allExercises.find((ex) => ex.id !== rows.at(-1)?.exerciseId)?.id ??
              firstId;
            setRows((current) => [
              ...current,
              { exerciseId, reps: "", weight: "" },
            ]);
          }}
        >
          + Outro exercício
        </button>
      </div>

      <RestTimer userId={userId} />

      {error && (
        <p
          role="alert"
          className="text-sm font-medium text-red-600 dark:text-red-400"
        >
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
