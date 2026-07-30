/**
 * Which sessions beat everything that came before them.
 *
 * A first session is never a record: there was nothing to beat, and badging it
 * would put "Recorde" on every exercise the first time you try it.
 */

export type RecordSession = {
  workoutId: number;
  /** Heaviest single set of the session. */
  maxWeight: number;
  /** Best estimated 1RM of the session — catches more reps at the same weight. */
  best1RM: number;
};

export type RecordFlags = {
  /** Heavier than any previous session. */
  weight: boolean;
  /** Better estimated 1RM than any previous session. */
  oneRm: boolean;
};

export function isRecord(flags: RecordFlags | undefined): boolean {
  return flags != null && (flags.weight || flags.oneRm);
}

/** pt-PT label for what was beaten, for a tooltip or list row. */
export function describeRecord(flags: RecordFlags): string {
  if (flags.weight && flags.oneRm) return "Recorde de peso e de 1RM estimado";
  if (flags.weight) return "Recorde de peso";
  return "Recorde de 1RM estimado";
}

/**
 * Walks sessions oldest → newest and flags the ones that set a new best.
 * Input order does not matter; ties never count, only strict improvements.
 */
export function markRecords(
  sessions: readonly (RecordSession & { date: string })[],
): Map<number, RecordFlags> {
  const ordered = [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.workoutId - b.workoutId,
  );

  const flags = new Map<number, RecordFlags>();
  let bestWeight = -Infinity;
  let best1RM = -Infinity;

  for (const [index, session] of ordered.entries()) {
    const beatsWeight = index > 0 && session.maxWeight > bestWeight;
    const beats1RM = index > 0 && session.best1RM > best1RM;
    if (beatsWeight || beats1RM) {
      flags.set(session.workoutId, { weight: beatsWeight, oneRm: beats1RM });
    }
    bestWeight = Math.max(bestWeight, session.maxWeight);
    best1RM = Math.max(best1RM, session.best1RM);
  }

  return flags;
}
