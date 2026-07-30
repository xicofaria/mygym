"use client";

import { useRef, useState, useTransition } from "react";
import {
  applyRoutineToMonth,
  saveRoutineDay,
} from "@/app/(app)/workouts/actions";
import { WEEKDAYS, type RoutineDay } from "@/lib/routine";
import { formatGroupNames } from "@/lib/muscle-groups";
import { GroupPicker } from "./group-picker";

type ByWeekday = Record<number, string[]>;

function toByWeekday(routine: readonly RoutineDay[]): ByWeekday {
  const result: ByWeekday = {};
  for (const day of WEEKDAYS) result[day.weekday] = [];
  for (const day of routine) result[day.weekday] = [...day.groups];
  return result;
}

export function RoutineEditor({
  initialRoutine,
  months,
}: {
  initialRoutine: RoutineDay[];
  months: { key: string; label: string }[];
}) {
  const [routine, setRoutine] = useState<ByWeekday>(() =>
    toByWeekday(initialRoutine),
  );
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(months[0]?.key ?? "");
  const [applied, setApplied] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [applying, startApply] = useTransition();
  const saveInFlight = useRef(false);
  const applyInFlight = useRef(false);

  function update(weekday: number, groups: string[]) {
    if (saveInFlight.current || applyInFlight.current) return;
    const previousGroups = routine[weekday] ?? [];
    saveInFlight.current = true;
    setRoutine((current) => ({ ...current, [weekday]: groups }));
    setError(null);
    setApplied(null);
    setSavingDay(weekday);
    startSave(async () => {
      try {
        const res = await saveRoutineDay({ weekday, groups });
        if ("error" in res) {
          setRoutine((current) => ({
            ...current,
            [weekday]: previousGroups,
          }));
          setError(res.error ?? "Não foi possível guardar a rotina.");
        } else {
          setRoutine((current) => ({
            ...current,
            [weekday]: res.groups,
          }));
        }
      } catch {
        setRoutine((current) => ({
          ...current,
          [weekday]: previousGroups,
        }));
        setError("Sem ligação ao servidor. A rotina não ficou guardada.");
      } finally {
        saveInFlight.current = false;
        setSavingDay(null);
      }
    });
  }

  function apply() {
    if (saveInFlight.current || applyInFlight.current) return;
    applyInFlight.current = true;
    setError(null);
    setApplied(null);
    startApply(async () => {
      try {
        const res = await applyRoutineToMonth(month);
        if (res?.error) {
          setError(res.error);
          return;
        }
        setApplied(
          res.created === 0
            ? "Nada a criar: os dias que faltam neste mês são de descanso ou já têm plano."
            : `${res.created} ${res.created === 1 ? "treino planeado" : "treinos planeados"}.`,
        );
      } catch {
        setError("Sem ligação ao servidor. Tenta novamente.");
      } finally {
        applyInFlight.current = false;
      }
    });
  }

  const hasAnyGroup = Object.values(routine).some((groups) => groups.length > 0);
  const savingRoutine = saving || savingDay != null;
  const interactionBlocked = savingRoutine || applying;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {WEEKDAYS.map((day) => {
          const groups = routine[day.weekday] ?? [];
          const open = openDay === day.weekday;
          return (
            <section key={day.weekday} className="card flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setOpenDay(open ? null : day.weekday)}
                aria-expanded={open}
                disabled={interactionBlocked}
                className="flex w-full cursor-pointer items-center gap-3 text-left disabled:cursor-wait disabled:opacity-60"
              >
                <span className="w-28 shrink-0 text-sm font-semibold">
                  {day.long}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-xs ${
                    groups.length === 0
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-indigo-600 dark:text-indigo-400"
                  }`}
                >
                  {savingDay === day.weekday && saving
                    ? "a guardar…"
                    : groups.length === 0
                      ? "Descanso"
                      : formatGroupNames(groups)}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {open && (
                <GroupPicker
                  value={groups}
                  onChange={(next) => update(day.weekday, next)}
                  disabled={interactionBlocked}
                />
              )}
            </section>
          );
        })}
      </div>

      <section className="card flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Aplicar a um mês</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Cria os treinos planeados de hoje em diante. Não mexe em dias que já
            tenham plano, por isso podes carregar as vezes que quiseres.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input flex-1"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Mês a preencher"
            disabled={interactionBlocked}
          >
            {months.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={apply}
            className="btn-primary shrink-0"
            disabled={interactionBlocked || !hasAnyGroup}
          >
            {applying ? "A aplicar…" : "Aplicar"}
          </button>
        </div>
        {!hasAnyGroup && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Escolhe primeiro o que treinas em pelo menos um dia da semana.
          </p>
        )}
        {applied && (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {applied}
          </p>
        )}
      </section>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
