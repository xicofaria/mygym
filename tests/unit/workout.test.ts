import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkoutSetRows,
  chooseTopSet,
} from "../../src/lib/workout";

test("set numbering restarts for each exercise", () => {
  assert.deepEqual(
    buildWorkoutSetRows(42, [
      { exerciseId: 1, reps: 10, weight: 20 },
      { exerciseId: 1, reps: 8, weight: 22 },
      { exerciseId: 2, reps: 12, weight: 15 },
      { exerciseId: 1, reps: 6, weight: 24 },
    ]),
    [
      { workoutId: 42, exerciseId: 1, setNumber: 1, reps: 10, weight: 20 },
      { workoutId: 42, exerciseId: 1, setNumber: 2, reps: 8, weight: 22 },
      { workoutId: 42, exerciseId: 2, setNumber: 1, reps: 12, weight: 15 },
      { workoutId: 42, exerciseId: 1, setNumber: 3, reps: 6, weight: 24 },
    ],
  );
});

test("top set uses repetitions as the tie-breaker", () => {
  assert.deepEqual(
    chooseTopSet(
      { weight: 24, reps: 8 },
      { weight: 24, reps: 12 },
    ),
    { weight: 24, reps: 12 },
  );
});

test("top set prioritizes weight over repetitions", () => {
  assert.deepEqual(
    chooseTopSet(
      { weight: 24, reps: 12 },
      { weight: 26, reps: 6 },
    ),
    { weight: 26, reps: 6 },
  );
});
