import assert from "node:assert/strict";
import test from "node:test";
import {
  groupsOverlap,
  suggestTemplates,
  templateMuscleGroups,
} from "../../src/lib/template-match";

const template = (id: number, name: string, groups: (string | null)[]) => ({
  id,
  name,
  exercises: groups.map((muscleGroup) => ({ muscleGroup })),
});

const PEITO = template(1, "Treino de Peito", ["Chest", "Chest", "Shoulders"]);
const PERNAS = template(2, "Treino de Pernas", ["Legs", "Legs"]);
const BRACOS = template(3, "Braços", ["Arms", "Arms"]);
const FULL = template(4, "Corpo inteiro", ["Chest", "Legs", "Back", "Arms"]);

test("legacy English groups are compared in their pt-PT form", () => {
  assert.equal(groupsOverlap("Peito", "Chest"), true);
  assert.equal(groupsOverlap("Dorsal", "Back"), true);
  assert.equal(groupsOverlap("Peito", "Legs"), false);
});

test("a broader group covers the muscles inside it", () => {
  // The seeded catalog files biceps and triceps under "Arms" → "Braços".
  assert.equal(groupsOverlap("Tríceps", "Arms"), true);
  assert.equal(groupsOverlap("Bíceps", "Braços"), true);
  assert.equal(groupsOverlap("Glúteos", "Legs"), true);
  assert.equal(groupsOverlap("Bíceps", "Peito"), false);
});

test("lists the distinct groups a template trains", () => {
  assert.deepEqual(templateMuscleGroups(PEITO), ["Peito", "Ombros"]);
  assert.deepEqual(templateMuscleGroups(template(9, "Sem grupo", [null])), []);
});

test("suggests the template covering most of the planned day", () => {
  const suggestions = suggestTemplates(
    ["Peito", "Tríceps", "Ombros"],
    [PEITO, PERNAS, BRACOS, FULL],
  );

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].template.name, "Treino de Peito");
  assert.deepEqual(suggestions[0].matched, ["Peito", "Ombros"]);
  // "Braços" covers only Tríceps but adds nothing unrelated, so it outranks
  // the full-body template that also matches two groups.
  assert.equal(suggestions[1].template.name, "Braços");
});

test("a focused template beats a full-body one on equal coverage", () => {
  const suggestions = suggestTemplates(["Pernas"], [FULL, PERNAS], 2);
  assert.equal(suggestions[0].template.name, "Treino de Pernas");
});

test("suggests nothing when nothing overlaps", () => {
  assert.deepEqual(suggestTemplates(["Cardio"], [PEITO, PERNAS]), []);
  assert.deepEqual(suggestTemplates([], [PEITO]), []);
  assert.deepEqual(suggestTemplates(["Peito"], []), []);
});

test("honours the requested limit", () => {
  const suggestions = suggestTemplates(
    ["Peito", "Pernas", "Bíceps"],
    [PEITO, PERNAS, BRACOS, FULL],
    1,
  );
  assert.equal(suggestions.length, 1);
});
