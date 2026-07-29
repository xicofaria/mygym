"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBodyMetric } from "@/app/(app)/body/actions";
import { toDateInputValue } from "@/lib/format";
import {
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
} from "@/lib/local-draft";

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
type BodyMetricDraft = {
  date: string;
  notes: string;
  values: Record<FieldKey, string>;
};

const DRAFT_KEY = "gym-tracker:body-metric-draft";

function emptyValues(): Record<FieldKey, string> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<
    FieldKey,
    string
  >;
}

function isBodyMetricDraft(value: unknown): value is BodyMetricDraft {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BodyMetricDraft>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.notes === "string" &&
    typeof candidate.values === "object" &&
    candidate.values !== null &&
    FIELDS.every(
      (field) => typeof candidate.values?.[field.key] === "string",
    )
  );
}

function num(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export function BodyMetricForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toDateInputValue());
  const [values, setValues] = useState<Record<FieldKey, string>>(emptyValues);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [draftReady, setDraftReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);

  useEffect(() => {
    const draft = readLocalDraft(localStorage, DRAFT_KEY, isBodyMetricDraft);
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (draft) {
        setDate(draft.date);
        setNotes(draft.notes);
        setValues(draft.values);
        setOpen(true);
        setDirty(true);
        setRestoredDraft(true);
      }
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftReady || !dirty || !open) return;
    writeLocalDraft(localStorage, DRAFT_KEY, { date, notes, values });
  }, [date, dirty, draftReady, notes, open, values]);

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

    const draft = { date, notes, values };
    removeLocalDraft(localStorage, DRAFT_KEY);

    start(async () => {
      try {
        const res = await createBodyMetric(input as never);
        if (res?.error) {
          writeLocalDraft(localStorage, DRAFT_KEY, draft);
          setError(res.error);
          return;
        }
        setValues(emptyValues());
        setNotes("");
        setOpen(false);
        setDirty(false);
        setRestoredDraft(false);
        router.refresh();
      } catch {
        writeLocalDraft(localStorage, DRAFT_KEY, draft);
        setError(
          "Sem ligação ao servidor. O rascunho ficou guardado neste dispositivo.",
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="body-metric-date">
          Data
        </label>
        <input
          id="body-metric-date"
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

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`body-metric-${f.key}`}>
              {f.label}
            </label>
            <input
              id={`body-metric-${f.key}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={f.step}
              className="input"
              value={values[f.key]}
              onChange={(e) => {
                setDirty(true);
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }}
              placeholder="—"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="body-metric-notes">
          Notas (opcional)
        </label>
        <input
          id="body-metric-notes"
          className="input"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
          }}
        />
      </div>

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

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            removeLocalDraft(localStorage, DRAFT_KEY);
            setValues(emptyValues());
            setNotes("");
            setOpen(false);
            setError(null);
            setDirty(false);
            setRestoredDraft(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
