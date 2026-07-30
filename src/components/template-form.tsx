"use client";

import { useState, useTransition } from "react";
import { createTemplate } from "@/app/(app)/workouts/templates/actions";

type Ex = { id: number; name: string };

export function TemplateForm({ exercises }: { exercises: Ex[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary w-full">
        + Novo modelo
      </button>
    );
  }

  function toggle(id: number) {
    setChosen((cs) =>
      cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Dá um nome ao modelo.");
      return;
    }
    if (chosen.length === 0) {
      setError("Escolhe pelo menos um exercício.");
      return;
    }
    start(async () => {
      const res = await createTemplate({ name, exerciseIds: chosen });
      if (res?.error) setError(res.error);
      // On success the server action redirects to /workouts/templates.
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="template-name">
          Nome do modelo
        </label>
        <input
          id="template-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex.: Treino de Pernas"
          autoFocus
        />
      </div>

      <div>
        <label className="label">
          Exercícios {chosen.length > 0 && `(${chosen.length} escolhidos)`}
        </label>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-black/10 p-1.5 dark:border-white/10">
          {exercises.map((ex) => {
            const idx = chosen.indexOf(ex.id);
            const active = idx !== -1;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => toggle(ex.id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <span>{ex.name}</span>
                {active && (
                  <span className="text-xs font-semibold opacity-80">
                    #{idx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "A guardar…" : "Guardar modelo"}
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
