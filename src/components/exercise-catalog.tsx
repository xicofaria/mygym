"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseStat } from "@/lib/queries";
import { matchesExercise } from "@/lib/exercise-catalog";
import { formatMuscleGroup } from "@/lib/muscle-groups";
import { fmtShortDate } from "@/lib/format";
import { setExerciseFavorite } from "@/app/(app)/exercises/actions";
import { AddExercise } from "./add-exercise";

export function ExerciseCatalog({
  exercises,
  favoriteIds,
  isSelf,
  query = "",
}: {
  exercises: ExerciseStat[];
  favoriteIds: number[];
  isSelf: boolean;
  query?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const favorites = new Set(favoriteIds);
  const visible = exercises
    .filter(
      (ex) =>
        matchesExercise(ex, search) &&
        (filter !== "favorites" || favorites.has(ex.id)) &&
        (filter !== "recent" || ex.lastPerformed != null),
    )
    .sort((a, b) =>
      filter === "recent"
        ? (b.lastPerformed?.getTime() ?? 0) - (a.lastPerformed?.getTime() ?? 0)
        : Number(favorites.has(b.id)) - Number(favorites.has(a.id)) ||
          a.name.localeCompare(b.name, "pt"),
    );

  function favorite(exerciseId: number) {
    setError(null);
    start(async () => {
      try {
        const result = await setExerciseFavorite({
          exerciseId,
          favorite: !favorites.has(exerciseId),
        });
        if (result.error) setError(result.error);
        else router.refresh();
      } catch {
        setError("Não foi possível atualizar o favorito. Tenta novamente.");
      }
    });
  }

  return (
    <section
      aria-label="Catálogo de exercícios"
      className="flex flex-col gap-4"
    >
      <div>
        <label className="label" htmlFor="catalog-search">
          Pesquisar exercícios
        </label>
        <input
          id="catalog-search"
          type="search"
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, músculo ou equipamento"
        />
      </div>
      <div className="flex gap-1 border-b border-black/10 dark:border-white/10">
        {[
          ["all", "Todos"],
          ...(isSelf ? [["favorites", "Favoritos"]] : []),
          ["recent", "Recentes"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-11 border-b-2 px-3 text-sm font-medium transition-colors ${filter === value ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="status" className="text-xs text-zinc-500">
        {visible.length} {visible.length === 1 ? "exercício" : "exercícios"}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {visible.length === 0 && (
        <p className="py-6 text-sm text-zinc-500">
          {filter === "favorites"
            ? "Marca uma estrela para teres os teus exercícios à mão."
            : "Não encontrámos exercícios. Experimenta outro nome ou filtro."}
        </p>
      )}
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {visible.map((ex) => (
          <article key={ex.id} className="py-3" aria-label={ex.name}>
            <div className="flex items-center gap-2">
              <Link
                href={`/exercises/${ex.id}${query}`}
                className="min-w-0 flex-1 rounded-lg py-2 transition-colors hover:text-indigo-600"
              >
                <h2 className="font-semibold">{ex.name}</h2>
                <p className="text-xs text-zinc-500">
                  {[
                    ex.muscleGroup && formatMuscleGroup(ex.muscleGroup),
                    ex.equipment,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {ex.aliases && (
                  <p className="mt-1 text-xs text-zinc-500">{ex.aliases}</p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  {ex.lastPerformed
                    ? `Última: ${fmtShortDate(ex.lastPerformed)} · ${ex.bestWeight} kg`
                    : "Ainda não treinado"}
                </p>
              </Link>
              {isSelf && (
                <button
                  type="button"
                  onClick={() => favorite(ex.id)}
                  disabled={pending}
                  aria-label={`${favorites.has(ex.id) ? "Remover" : "Adicionar"} ${ex.name} ${favorites.has(ex.id) ? "dos" : "aos"} favoritos`}
                  aria-pressed={favorites.has(ex.id)}
                  className="min-h-11 min-w-11 rounded-lg text-xl text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-white/5"
                >
                  {favorites.has(ex.id) ? "★" : "☆"}
                </button>
              )}
            </div>
            {isSelf && <AddExercise exercise={ex} />}
          </article>
        ))}
      </div>
    </section>
  );
}
