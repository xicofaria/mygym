"use client";

import { useId, useState } from "react";
import {
  MAX_GROUPS_PER_DAY,
  MAX_GROUP_NAME_LENGTH,
  MUSCLE_GROUP_SUGGESTIONS,
  normalizeGroupName,
} from "@/lib/muscle-groups";

function sameGroup(a: string, b: string): boolean {
  return a.toLocaleLowerCase("pt-PT") === b.toLocaleLowerCase("pt-PT");
}

/**
 * Picks what a session trains. The suggestions are just a shortcut — anything
 * the user types is equally valid.
 */
export function GroupPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly string[];
  onChange: (groups: string[]) => void;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState("");
  const inputId = useId();
  const full = value.length >= MAX_GROUPS_PER_DAY;

  const extras = value.filter(
    (group) => !MUSCLE_GROUP_SUGGESTIONS.some((s) => sameGroup(s, group)),
  );

  function toggle(group: string) {
    const existing = value.find((item) => sameGroup(item, group));
    if (existing) {
      onChange(value.filter((item) => item !== existing));
    } else if (!full) {
      onChange([...value, group]);
    }
  }

  function addCustom() {
    const name = normalizeGroupName(custom);
    if (!name || full) return;
    setCustom("");
    if (value.some((item) => sameGroup(item, name))) return;
    onChange([...value, name]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {[...MUSCLE_GROUP_SUGGESTIONS, ...extras].map((group) => {
          const active = value.some((item) => sameGroup(item, group));
          return (
            <button
              key={group}
              type="button"
              onClick={() => toggle(group)}
              aria-pressed={active}
              disabled={disabled || (full && !active)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                active
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
              }`}
            >
              {group}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          id={inputId}
          className="input"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustom();
            }
          }}
          placeholder="Outro grupo…"
          maxLength={MAX_GROUP_NAME_LENGTH}
          disabled={disabled || full}
          aria-label="Adicionar outro grupo"
        />
        <button
          type="button"
          onClick={addCustom}
          className="btn-ghost shrink-0"
          disabled={disabled || full || normalizeGroupName(custom) == null}
        >
          Adicionar
        </button>
      </div>

      {full && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Máximo de {MAX_GROUPS_PER_DAY} grupos por dia.
        </p>
      )}
    </div>
  );
}
