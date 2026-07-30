import assert from "node:assert/strict";
import test from "node:test";
import { formatMuscleGroup } from "../../src/lib/muscle-groups";

test("traduz os grupos musculares antigos do catálogo inicial", () => {
  assert.equal(formatMuscleGroup("Chest"), "Peito");
  assert.equal(formatMuscleGroup(" shoulders "), "Ombros");
});

test("preserva grupos personalizados", () => {
  assert.equal(formatMuscleGroup("Mobilidade"), "Mobilidade");
});
