"use client";

import { useState, useTransition } from "react";
import { createPlannedWorkout } from "@/app/(app)/workouts/actions";

/** Schedules a workout (optionally from a template) on the selected date. */
export function PlanWorkoutForm({
  date,
  templates,
}: {
  date: string;
  templates: { id: number; name: string }[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await createPlannedWorkout({
          date,
          templateId: templateId ? Number(templateId) : undefined,
          notes: notes.trim() || undefined,
        });
        if (res?.error) {
          setError(res.error);
          return;
        }
        setTemplateId("");
        setNotes("");
      } catch {
        setError("Sem ligação ao servidor. Tenta novamente.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="label" htmlFor="plan-template">
        Planear treino para este dia
      </label>
      <select
        id="plan-template"
        className="input"
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
      >
        <option value="">Sem modelo</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      <input
        className="input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        maxLength={1000}
      />
      <button type="submit" className="btn-ghost" disabled={pending}>
        {pending ? "A planear…" : "Planear treino"}
      </button>
      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
