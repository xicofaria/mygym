"use client";

import { useState, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { completeOnboarding } from "@/app/(app)/onboarding-actions";
import { BodyMetricForm } from "./body-metric-form";

export function GettingStarted({ userId, hasWeight }: { userId: number; hasWeight: boolean }) {
  const router = useRouter();
  const [savedWeight, setSavedWeight] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function finish(destination?: string) {
    setError("");
    start(async () => {
      try {
        await completeOnboarding();
        if (destination) router.push(destination);
        else router.refresh();
      } catch (cause) {
        unstable_rethrow(cause);
        setError("Não foi possível concluir a configuração. Tenta novamente.");
      }
    });
  }
  return (
    <section aria-labelledby="getting-started-title" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
      <h2 id="getting-started-title" className="text-lg font-semibold">O teu ponto de partida</h2>
      <p className="my-2 text-sm">Regista o teu peso para acompanhares a evolução corporal. É opcional: podes começar a treinar e completar estes dados mais tarde.</p>
      <fieldset className="contents" disabled={pending}>
        {hasWeight || savedWeight ? (
          <p role="status" className="my-3 text-sm">Peso inicial registado. Podes consultar e acrescentar medidas em Corpo.</p>
        ) : (
          <BodyMetricForm userId={userId} initiallyOpen onSaved={() => setSavedWeight(true)} />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => finish("/calories?setup=goal")}>Configurar alimentação</button>
          <button className="btn-ghost" onClick={() => finish()}>{hasWeight || savedWeight ? "Concluir configuração" : "Agora não"}</button>
        </div>
      </fieldset>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">As metas alimentares são definidas por ti. Não calculamos uma dieta a partir do teu peso.</p>
      {pending && <p role="status" className="text-sm">A guardar preferência…</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
