"use client";

import { useCallback, useEffect, useState } from "react";
import { readLocalDraft, writeLocalDraft } from "@/lib/local-draft";

type Timer = { deadline: number | null; remaining: number };
function isTimer(value: unknown): value is Timer {
  if (!value || typeof value !== "object") return false;
  const timer = value as Timer;
  return (
    (timer.deadline === null ||
      (Number.isFinite(timer.deadline) && timer.deadline > 0)) &&
    Number.isFinite(timer.remaining) &&
    timer.remaining >= 0 &&
    timer.remaining <= 3600
  );
}

/** Absolute deadlines keep the countdown correct when the browser sleeps. */
export function RestTimer({ userId }: { userId: number }) {
  const key = `gym-tracker:rest:user-${userId}`;
  const [timer, setTimer] = useState<Timer>({ deadline: null, remaining: 90 });
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = readLocalDraft(localStorage, key, isTimer);
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (saved) setTimer(saved);
      setNow(Date.now());
      setReady(true);
    });
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [key]);
  const seconds =
    timer.deadline === null
      ? timer.remaining
      : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
  const running = timer.deadline !== null && seconds > 0;
  const change = useCallback(
    (next: Timer) => {
      setNow(Date.now());
      setTimer(next);
      writeLocalDraft(localStorage, key, next);
    },
    [key],
  );
  return (
    <section
      aria-label="Temporizador de descanso"
      className="flex flex-col gap-3 border-y border-black/10 py-4 dark:border-white/10"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Descanso</h2>
        <output
          aria-label="Tempo de descanso"
          className="text-3xl font-semibold tabular-nums"
        >
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </output>
      </div>
      <div className="flex flex-wrap gap-2">
        {[60, 90, 120].map((duration) => (
          <button
            key={duration}
            type="button"
            className="btn-ghost"
            disabled={!ready}
            onClick={() => change({ deadline: null, remaining: duration })}
          >
            {duration}s
          </button>
        ))}
        <button
          type="button"
          className="btn-primary"
          disabled={!ready}
          onClick={() => {
            const remaining =
              timer.deadline === null
                ? timer.remaining
                : Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
            change(
              running
                ? { deadline: null, remaining }
                : {
                    deadline: Date.now() + (remaining || 90) * 1000,
                    remaining: remaining || 90,
                  },
            );
          }}
        >
          {running ? "Pausar descanso" : "Iniciar descanso"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!ready}
          onClick={() => change({ deadline: null, remaining: 90 })}
        >
          Repor
        </button>
      </div>
      <p role="status" className="text-xs text-zinc-500">
        {ready && timer.deadline !== null && seconds === 0
          ? "Descanso terminado."
          : "O temporizador não altera nem guarda as séries."}
      </p>
    </section>
  );
}
