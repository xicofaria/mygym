export type WorkoutEntry = {
  exerciseId: number;
  reps: number;
  weight: number;
};

export type StoredWorkoutSet = WorkoutEntry & {
  workoutId: number;
  setNumber: number;
};

/**
 * Builds deterministic set rows for a workout. Set numbers restart for each
 * exercise while preserving the order submitted by the user.
 */
export function buildWorkoutSetRows(
  workoutId: number,
  entries: WorkoutEntry[],
): StoredWorkoutSet[] {
  const counters = new Map<number, number>();

  return entries.map((entry) => {
    const setNumber = (counters.get(entry.exerciseId) ?? 0) + 1;
    counters.set(entry.exerciseId, setNumber);

    return {
      workoutId,
      exerciseId: entry.exerciseId,
      setNumber,
      reps: entry.reps,
      weight: entry.weight,
    };
  });
}

/**
 * Selects the top set by weight and then by repetitions when weights tie.
 */
export function chooseTopSet<T extends { weight: number; reps: number }>(
  current: T,
  candidate: T,
): T {
  if (candidate.weight > current.weight) return candidate;
  if (candidate.weight === current.weight && candidate.reps > current.reps) {
    return candidate;
  }
  return current;
}
