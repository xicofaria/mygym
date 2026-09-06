"use client";

import { useEffect, useState } from "react";

export function AIThinking({
  onCancel,
  food = false,
}: {
  onCancel: () => void;
  food?: boolean;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <div
      className="my-3 border-l-2 border-indigo-500 py-2 pl-3"
      aria-label="Análise IA em curso"
    >
      <div
        role="status"
        className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300"
      >
        <span aria-hidden="true" className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        {food
          ? "A analisar a fotografia e a calcular…"
          : "A analisar a fotografia…"}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        <span aria-hidden="true">{seconds} s · </span>Pode demorar até 2
        minutos. Aguarda a resposta antes de rever os valores.
      </p>
      <button type="button" className="btn-ghost mt-2" onClick={onCancel}>
        Cancelar análise
      </button>
    </div>
  );
}
