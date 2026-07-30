/**
 * The vocabulary for "what am I training". Suggestions are pt-PT and cover the
 * usual split, but a group is just a label — anything the user types is valid.
 */

export const MUSCLE_GROUP_SUGGESTIONS = [
  "Peito",
  "Dorsal",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Pernas",
  "Glúteos",
  "Gémeos",
  "Abdominais",
  "Lombar",
  "Antebraço",
  "Cardio",
  "Corpo inteiro",
  "Mobilidade",
] as const;

export const MAX_GROUP_NAME_LENGTH = 30;
export const MAX_GROUPS_PER_DAY = 8;

const LEGACY_MUSCLE_GROUP_LABELS: Readonly<Record<string, string>> = {
  arms: "Braços",
  back: "Dorsal",
  chest: "Peito",
  core: "Abdominais",
  legs: "Pernas",
  shoulders: "Ombros",
};

/** Keeps older seeded exercise data readable in pt-PT without rewriting it. */
export function formatMuscleGroup(value: string): string {
  return LEGACY_MUSCLE_GROUP_LABELS[value.trim().toLowerCase()] ?? value;
}

/** Trims and collapses whitespace; returns null when nothing usable is left. */
export function normalizeGroupName(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_GROUP_NAME_LENGTH);
}

/**
 * Cleans a list of group names: normalizes each, drops blanks and
 * case-insensitive duplicates, and caps the length. Order is preserved.
 */
export function normalizeGroupNames(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const name = normalizeGroupName(value);
    if (name == null) continue;
    const key = name.toLocaleLowerCase("pt-PT");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length === MAX_GROUPS_PER_DAY) break;
  }
  return result;
}

/** "Peito · Tríceps · Ombros" — the compact form used in lists and labels. */
export function formatGroupNames(names: readonly string[]): string {
  return names.join(" · ");
}
