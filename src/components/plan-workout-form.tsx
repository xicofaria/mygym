"use client";

import { useState, useTransition } from "react";
import { createPlannedWorkout } from "@/app/(app)/workouts/actions";
import { GroupPicker } from "./group-picker";

/** Schedules a workout on the selected date: what it trains, and optionally
 * which template to start it from. */
export function PlanWorkoutForm({
  date,
  templates,
}: {
  date: string;
  templates: { id: number; name: string }[];
}) {
  const [groups, setGroups] = useState<string[]>([]);
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
          groups,
          templateId: templateId ? Number(templateId) : undefined,
          notes: notes.trim() || undefined,
        });
        if (res?.error) {
          setError(res.error);
          return;
        }
        setGroups([]);
        setTemplateId("");
        setNotes("");
      } catch {
        setError("Sem ligação ao servidor. Tenta novamente.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <p className="label">O que vais treinar neste dia?</p>
        <GroupPicker value={groups} onChange={setGroups} disabled={pending} />
      </div>

      {templates.length > 0 && (
        <div>
          <label className="label" htmlFor="plan-template">
            Começar de um modelo (opcional)
          </label>
          <select
            id="plan-template"
            className="input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={pending}
          >
            <option value="">Sem modelo</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        className="input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        maxLength={1000}
        disabled={pending}
        aria-label="Notas do plano"
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
