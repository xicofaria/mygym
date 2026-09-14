import { isDateKey } from "./workout-calendar";

export type WorkoutDraft = {
  date: string;
  notes: string;
  rows: { exerciseId: number; reps: string; weight: string }[];
};

export function isWorkoutDraft(value: unknown): value is WorkoutDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<WorkoutDraft>;
  // Drafts may contain unfinished/invalid input. Validation belongs to submit;
  // rejecting it here would delete the very data the person needs to correct.
  return typeof draft.date === "string" &&
    typeof draft.notes === "string" &&
    Array.isArray(draft.rows) && draft.rows.length > 0 &&
    draft.rows.every(row => row !== null && typeof row === "object" &&
      Number.isSafeInteger(row.exerciseId) && row.exerciseId >= 0 &&
      typeof row.reps === "string" && typeof row.weight === "string");
}

export function workoutDraftHref(key: string, userId: number): string | null {
  const prefix = `gym-tracker:workout-draft:user-${userId}:`;
  if (!key.startsWith(prefix)) return null;
  const match = /^(new|[1-9]\d*)(?::(.+))?$/.exec(key.slice(prefix.length));
  if (!match) return null;
  if (match[1] !== "new") return match[2] ? null : `/workouts/${match[1]}/edit`;
  const params = new URLSearchParams();
  for (const part of match[2]?.split("|") ?? []) {
    if (part === "repeat") params.set("repeat", "last");
    else {
      const separator = part.indexOf(":");
      const name = part.slice(0, separator), value = part.slice(separator + 1);
      if (name === "date" && isDateKey(value)) params.set("date", value);
      else if ((name === "tpl" || name === "plan") && /^[1-9]\d*$/.test(value)) params.set(name === "tpl" ? "template" : name, value);
      else if (name === "session" && /^[a-f0-9-]{36}$/.test(value)) params.set("session", value);
      else return null;
    }
  }
  const query = params.toString();
  return `/workouts/new${query ? `?${query}` : ""}`;
}

export function listWorkoutDrafts(storage: Storage, userId: number) {
  const drafts: { key: string; href: string; date: string; savedAt: string }[] = [];
  try {
    for (const key of Object.keys(storage)) {
      const href = workoutDraftHref(key, userId);
      if (!href) continue;
      try {
        const envelope = JSON.parse(storage.getItem(key) ?? "null");
        if (envelope?.version !== 1 || !isWorkoutDraft(envelope.data) ||
          typeof envelope.savedAt !== "string" || !Number.isFinite(Date.parse(envelope.savedAt))) continue;
        drafts.push({ key, href, date: envelope.data.date, savedAt: envelope.savedAt });
      } catch { /* Ignore malformed local data; never affect another account. */ }
    }
  } catch { /* Storage unavailable: no promise of recovery. */ }
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
