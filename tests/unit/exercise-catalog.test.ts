import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichExercise,
  matchesExercise,
  exerciseInputSchema,
} from "../../src/lib/exercise-catalog";

test("search includes Portuguese aliases, accents, equipment and legacy muscle groups", () => {
  assert.ok(
    matchesExercise(
      { id: 1, name: "Bench Press", muscleGroup: "chest" },
      "supino peito barra",
    ),
  );
  assert.ok(matchesExercise({ id: 2, name: "Bicep Curl" }, "biceps"));
  assert.ok(matchesExercise({ id: 3, name: "Leg Press" }, "maquina prensa"));
  assert.equal(matchesExercise({ id: 3, name: "Leg Press" }, "supino"), false);
});
test("explicit catalogue metadata wins, including cleared fields", () => {
  const custom = {
    id: 1,
    name: "Bench Press",
    aliases: "",
    equipment: "Máquina",
  };
  assert.deepEqual(enrichExercise(custom), custom);
  assert.equal(
    exerciseInputSchema.safeParse({ name: "Test", aliases: "x".repeat(301) })
      .success,
    false,
  );
  assert.equal(
    exerciseInputSchema.safeParse({ name: "Test", equipment: "unknown" })
      .success,
    false,
  );
});
