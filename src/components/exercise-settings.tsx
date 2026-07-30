"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExercise, updateExercise } from "@/app/(app)/exercises/actions";

/**
 * Rename an exercise or drop it from the shared catalog. Deleting is refused
 * server-side while any set or template still points at it, so the button is
 * safe to offer even when the exercise has history.
 */
export function ExerciseSettings({
  id,
  name,
  muscleGroup,
  usedInSets,
}: {
  id: number;
  name: string;
  muscleGroup: string | null;
  /** Whether this exercise already has logged sets, which blocks deletion. */
  usedInSets: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nextName, setNextName] = useState(name);
  const [nextGroup, setNextGroup] = useState(muscleGroup ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost w-full"
      >
        Editar exercício
      </button>
    );
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        const res = await updateExercise(id, {
          name: nextName,
          muscleGroup: nextGroup.trim() || undefined,
        });
        if (res?.error) {
          setError(res.error);
          return;
        }
        setSaved(true);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Sem ligação ao servidor. Tenta novamente.");
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        "Eliminar este exercício do catálogo? Só é possível se não tiver séries nem modelos.",
      )
    ) {
      return;
    }
    setError(null);
    // No try/catch: a successful delete redirects, and Next signals that by
    // throwing — swallowing it here would leave the user on a dead page.
    start(async () => {
      const res = await deleteExercise(id);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="edit-exercise-name">
          Nome do exercício
        </label>
        <input
          id="edit-exercise-name"
          className="input"
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
          maxLength={80}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="edit-exercise-group">
          Grupo muscular
        </label>
        <input
          id="edit-exercise-group"
          className="input"
          value={nextGroup}
          onChange={(event) => setNextGroup(event.target.value)}
          maxLength={40}
          placeholder="opcional"
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Guardado.
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={() => {
            setNextName(name);
            setNextGroup(muscleGroup ?? "");
            setError(null);
            setOpen(false);
          }}
        >
          Cancelar
        </button>
      </div>

      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="btn-danger"
      >
        Eliminar do catálogo
      </button>
      {usedInSets && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Este exercício já tem séries registadas — mudar o nome mantém todo o
          histórico, eliminar não é possível.
        </p>
      )}
    </form>
  );
}
