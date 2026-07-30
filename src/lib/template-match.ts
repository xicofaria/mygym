import { formatMuscleGroup } from "./muscle-groups";

/**
 * Suggests which saved template fits a planned day.
 *
 * A plan says "Peito · Tríceps"; a template is a list of exercises, each with
 * a muscle group. Matching them lets a planned day offer the routine that
 * trains it instead of leaving the user to remember which one it was.
 */

export type TemplateLike = {
  id: number;
  name: string;
  exercises: { muscleGroup: string | null }[];
};

export type TemplateSuggestion<T extends TemplateLike> = {
  template: T;
  /** The planned groups this template covers, as the user wrote them. */
  matched: string[];
};

/**
 * Groups that contain other groups. The seeded catalog files both biceps and
 * triceps under "Braços", so a "Tríceps" day would otherwise match nothing.
 * Keys and values are compared lowercased.
 */
const CONTAINS: Readonly<Record<string, readonly string[]>> = {
  braços: ["bíceps", "tríceps", "antebraço"],
  pernas: ["glúteos", "gémeos", "quadríceps", "femoral", "coxa"],
  abdominais: ["core", "lombar"],
  dorsal: ["costas"],
  "corpo inteiro": [],
};

const key = (value: string) =>
  formatMuscleGroup(value).trim().toLocaleLowerCase("pt-PT");

/** True when two group labels refer to the same or overlapping muscles. */
export function groupsOverlap(a: string, b: string): boolean {
  const left = key(a);
  const right = key(b);
  if (left === right) return true;
  return (
    (CONTAINS[left]?.includes(right) ?? false) ||
    (CONTAINS[right]?.includes(left) ?? false)
  );
}

/** The distinct muscle groups a template trains, in pt-PT display form. */
export function templateMuscleGroups(template: TemplateLike): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const exercise of template.exercises) {
    if (!exercise.muscleGroup) continue;
    const label = formatMuscleGroup(exercise.muscleGroup).trim();
    const id = label.toLocaleLowerCase("pt-PT");
    if (label.length === 0 || seen.has(id)) continue;
    seen.add(id);
    labels.push(label);
  }
  return labels;
}

/**
 * Templates that train at least one of the planned groups, best fit first.
 *
 * Fit is the number of planned groups covered, minus half a point for every
 * group the template trains that was not planned. Without that penalty a
 * full-body template would outrank a focused one simply by touching more
 * muscles, which is the opposite of a useful suggestion.
 */
export function suggestTemplates<T extends TemplateLike>(
  plannedGroups: readonly string[],
  templates: readonly T[],
  limit = 2,
): TemplateSuggestion<T>[] {
  if (plannedGroups.length === 0) return [];

  return templates
    .map((template) => {
      const covered = templateMuscleGroups(template);
      const matched = plannedGroups.filter((planned) =>
        covered.some((group) => groupsOverlap(planned, group)),
      );
      const extra = covered.filter(
        (group) => !plannedGroups.some((planned) => groupsOverlap(planned, group)),
      ).length;
      return { template, matched, extra, score: matched.length - extra * 0.5 };
    })
    .filter((entry) => entry.matched.length > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.extra - b.extra ||
        a.template.name.localeCompare(b.template.name, "pt-PT"),
    )
    .slice(0, limit)
    .map(({ template, matched }) => ({ template, matched }));
}
