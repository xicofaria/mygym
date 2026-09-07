export function normalizeTextMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
}

function editDistance(a: string, b: string) {
  const left = [...a];
  const right = [...b];
  const row = Array.from({ length: right.length + 1 }, (_, j) => j);
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const keep = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      previous = keep;
    }
  }
  return row[right.length];
}

export function tokenSimilarity(a: string, b: string) {
  const left = normalizeTextMatch(a)
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const right = normalizeTextMatch(b)
    .split(/\s+/)
    .filter((token) => token.length > 2);
  if (!left.length || !right.length) return 0;
  let total = 0;
  for (const token of left)
    total += Math.max(
      0,
      ...right.map(
        (other) =>
          1 - editDistance(token, other) / Math.max(token.length, other.length),
      ),
    );
  return total / left.length;
}

export type SimilarExercise = {
  id: number;
  name: string;
  muscleGroup?: string | null;
  aliases?: string;
};

/** Best fuzzy match of a proposed name against catalogue names and aliases. */
export function bestCatalogMatch(
  proposal: { name: string; muscleGroup: string },
  catalog: SimilarExercise[],
): { exercise: SimilarExercise; score: number } | null {
  let best: { exercise: SimilarExercise; score: number } | null = null;
  for (const exercise of catalog) {
    const names = [exercise.name, ...(exercise.aliases || "").split(/,/)].filter(
      (alias) => alias.trim().length > 0,
    );
    for (const alias of names) {
      const score =
        0.7 * tokenSimilarity(proposal.name, alias) +
        0.3 *
          tokenSimilarity(
            `${proposal.name} ${proposal.muscleGroup}`,
            `${alias} ${exercise.muscleGroup || ""}`,
          );
      if (!best || score > best.score) best = { exercise, score };
    }
  }
  return best;
}
