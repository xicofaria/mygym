"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBodyMetric } from "@/app/(app)/body/actions";
import { toDateInputValue } from "@/lib/format";

const FIELDS = [
  { key: "weightKg", label: "Peso (kg)", step: 0.1 },
  { key: "bodyFatPct", label: "Gordura corporal (%)", step: 0.1 },
  { key: "waistCm", label: "Cintura (cm)", step: 0.1 },
  { key: "chestCm", label: "Peito (cm)", step: 0.1 },
  { key: "armCm", label: "Braço (cm)", step: 0.1 },
  { key: "thighCm", label: "Coxa (cm)", step: 0.1 },
  { key: "hipCm", label: "Anca (cm)", step: 0.1 },
  { key: "heightCm", label: "Altura (cm)", step: 0.1 },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

function num(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export function BodyMetricForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toDateInputValue());
  const [values, setValues] = useState<Record<FieldKey, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<
      FieldKey,
      string
    >,
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary w-full">
        + Adicionar medição
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: Record<string, number | string | undefined> = { date };
    let any = false;
    for (const f of FIELDS) {
      const v = num(values[f.key]);
      if (v != null) any = true;
      input[f.key] = v;
    }
    if (!any) {
      setError("Introduz pelo menos uma medida.");
      return;
    }
    input.notes = notes || undefined;

    start(async () => {
      const res = await createBodyMetric(input as never);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setValues(
        Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<
          FieldKey,
          string
        >,
      );
      setNotes("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
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

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={f.step}
              className="input"
              value={values[f.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              placeholder="—"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="label">Notas (opcional)</label>
        <input
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
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
