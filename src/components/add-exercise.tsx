"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExercise, updateExercise } from "@/app/(app)/exercises/actions";
import type { SearchableExercise } from "@/lib/exercise-catalog";

/** Shared catalogue metadata, with stable IDs preserving workout history. */
export function AddExercise({ exercise }: { exercise?: SearchableExercise }) {
  const router = useRouter();
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(exercise?.name ?? "");
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscleGroup ?? "");
  const [aliases, setAliases] = useState(exercise?.aliases ?? "");
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost"
        aria-label={exercise ? `Editar ${exercise.name}` : undefined}
      >
        {exercise ? "Editar detalhes" : "+ Novo exercício"}
      </button>
    );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const input = { name, muscleGroup, aliases, equipment };
        const result = exercise
          ? await updateExercise(exercise.id, input)
          : await createExercise(input);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (!exercise) {
          setName("");
          setMuscleGroup("");
          setAliases("");
          setEquipment("");
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("Não foi possível guardar. Tenta novamente.");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-t border-black/10 py-4 dark:border-white/10"
    >
      <p className="text-xs text-zinc-500">
        Catálogo partilhado entre as duas contas.
      </p>
      {[
        {
          key: "name",
          label: "Nome do exercício",
          value: name,
          set: setName,
          max: 80,
          placeholder: "ex.: Crucifixo no cabo",
        },
        {
          key: "group",
          label: "Grupo muscular",
          value: muscleGroup,
          set: setMuscleGroup,
          max: 40,
          placeholder: "ex.: Peito",
        },
        {
          key: "aliases",
          label: "Nomes alternativos",
          value: aliases,
          set: setAliases,
          max: 300,
          placeholder: "ex.: Supino, Chest press",
        },
      ].map((field) => (
        <div key={field.key}>
          <label className="label" htmlFor={prefix + field.key}>
            {field.label}
          </label>
          <input
            id={prefix + field.key}
            className="input"
            value={field.value}
            maxLength={field.max}
            required={field.key === "name"}
            onChange={(e) => field.set(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      ))}
      <div>
        <label className="label" htmlFor={prefix + "equipment"}>
          Equipamento
        </label>
        <select
          id={prefix + "equipment"}
          className="input"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          {[
            "",
            "Máquina",
            "Polia / cabo",
            "Barra",
            "Halteres",
            "Peso corporal",
            "Outro",
          ].map((value) => (
            <option key={value} value={value}>
              {value || "Não especificado"}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending
            ? "A guardar…"
            : exercise
              ? "Guardar detalhes"
              : "Adicionar exercício"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
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
