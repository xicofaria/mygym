"use client";

import { useState } from "react";
import {
  matchesExercise,
  type SearchableExercise,
} from "@/lib/exercise-catalog";

export function ExercisePicker({
  exercises,
  value,
  label,
  onChange,
  favoriteIds,
  recentIds,
}: {
  exercises: SearchableExercise[];
  value: number;
  label: string;
  onChange: (id: number) => void;
  favoriteIds: number[];
  recentIds: number[];
}) {
  const [search, setSearch] = useState("");
  const matching = exercises.filter((ex) => matchesExercise(ex, search));
  const favorite = matching.filter((ex) => favoriteIds.includes(ex.id));
  const recent = matching
    .filter((ex) => !favoriteIds.includes(ex.id) && recentIds.includes(ex.id))
    .sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
  const remaining = matching.filter(
    (ex) => !favoriteIds.includes(ex.id) && !recentIds.includes(ex.id),
  );
  const selected = exercises.find((ex) => ex.id === value);
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        className="input text-sm"
        aria-label={`Pesquisar catálogo: ${label.match(/\d+/)?.[0] ?? ""}`}
        placeholder="Pesquisar nome ou equipamento"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label={label}
        className="input font-semibold"
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
          setSearch("");
        }}
      >
        {selected && !matching.some((ex) => ex.id === value) && (
          <option value={value}>{selected.name} (selecionado)</option>
        )}
        {[
          ["Favoritos", favorite],
          ["Recentes", recent],
          ["Catálogo", remaining],
        ].map(
          ([name, entries]) =>
            (entries as SearchableExercise[]).length > 0 && (
              <optgroup key={String(name)} label={String(name)}>
                {(entries as SearchableExercise[]).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </select>
      {search && matching.length === 0 && (
        <p role="status" className="text-xs text-zinc-500">
          Sem resultados. O exercício selecionado foi mantido.
        </p>
      )}
    </div>
  );
}
