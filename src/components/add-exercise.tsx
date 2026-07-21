"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExercise } from "@/app/(app)/exercises/actions";

/** Inline form to add a movement to the shared exercise catalog. */
export function AddExercise() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost w-full">
        + Novo exercício
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Introduz um nome.");
      return;
    }
    start(async () => {
      const res = await createExercise({
        name,
        muscleGroup: muscleGroup || undefined,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setName("");
      setMuscleGroup("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <div>
        <label className="label">Nome do exercício</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex.: Crucifixo no cabo"
          autoFocus
        />
      </div>
      <div>
        <label className="label">Grupo muscular</label>
        <input
          className="input"
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          placeholder="opcional"
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "A adicionar…" : "Adicionar exercício"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
