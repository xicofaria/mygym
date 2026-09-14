import assert from "node:assert/strict";
import test from "node:test";
import { isWorkoutDraft, listWorkoutDrafts, workoutDraftHref } from "../../src/lib/workout-draft";

test("retoma aceita apenas rotas internas da conta e conserva o contexto", () => {
  const prefix = "gym-tracker:workout-draft:user-7:";
  assert.equal(workoutDraftHref(`${prefix}new`, 7), "/workouts/new");
  assert.equal(workoutDraftHref(`${prefix}24`, 7), "/workouts/24/edit");
  assert.equal(workoutDraftHref(`${prefix}new:date:2026-01-05|plan:3|tpl:2|repeat`, 7), "/workouts/new?date=2026-01-05&plan=3&template=2&repeat=last");
  assert.equal(workoutDraftHref(`${prefix}new`, 70), null);
  assert.equal(workoutDraftHref(`${prefix}new:https://example.com`, 7), null);
  assert.equal(workoutDraftHref(`${prefix}new:date:2026-02-30`, 7), null);
  assert.equal(workoutDraftHref("gym-tracker:workout-draft:new", 7), null);
});

test("lista só os rascunhos válidos da conta, ordenados pela última gravação", () => {
  const data = { date: "2026-01-05", notes: "", rows: [{ exerciseId: 0, reps: "", weight: "" }] };
  const envelope = (savedAt: string) => JSON.stringify({ version: 1, savedAt, data });
  const records: Record<string, string> = {
    "gym-tracker:workout-draft:user-7:new": envelope("2026-01-05T10:00:00Z"),
    "gym-tracker:workout-draft:user-7:new:repeat": envelope("2026-01-05T12:00:00Z"),
    "gym-tracker:workout-draft:user-8:new": envelope("2026-01-05T13:00:00Z"),
    "gym-tracker:workout-draft:user-7:9": "broken",
  };
  const storage = { ...records, getItem: (key: string) => records[key] ?? null } as unknown as Storage;
  assert.deepEqual(listWorkoutDrafts(storage, 7).map(d => d.href), ["/workouts/new?repeat=last", "/workouts/new"]);
  assert.equal(records["gym-tracker:workout-draft:user-7:9"], "broken");
  assert.ok(isWorkoutDraft({ ...data, date: "", notes: "x".repeat(1001) }));
  assert.ok(!isWorkoutDraft({ ...data, rows: [null] }));
});
