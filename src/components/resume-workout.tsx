"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listWorkoutDrafts } from "@/lib/workout-draft";

export function ResumeWorkout({ userId }: { userId: number }) {
  const [drafts, setDrafts] = useState<ReturnType<typeof listWorkoutDrafts>>([]);
  useEffect(() => {
    const refresh = () => {
      try { setDrafts(listWorkoutDrafts(localStorage, userId)); }
      catch { setDrafts([]); }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);
  if (!drafts.length) return null;
  return <section aria-label="Treinos por guardar" className="card flex flex-col gap-3">
    <h2 className="font-semibold">Treinos por guardar</h2>
    <p className="text-xs text-zinc-500">Rascunhos neste dispositivo. Ainda não estão guardados no servidor.</p>
    {drafts.map(draft => <div key={draft.key}>
      <Link className="font-medium text-indigo-600 underline dark:text-indigo-400" href={draft.href}>
        Continuar treino de {draft.date.split("-").reverse().join("/")}
      </Link>
      <p className="text-xs text-zinc-500">Guardado localmente em {new Date(draft.savedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}</p>
    </div>)}
  </section>;
}
