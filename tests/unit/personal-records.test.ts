import assert from "node:assert/strict";
import test from "node:test";
import {
  describeRecord,
  isRecord,
  markRecords,
} from "../../src/lib/personal-records";

const session = (
  workoutId: number,
  date: string,
  maxWeight: number,
  best1RM: number,
) => ({ workoutId, date, maxWeight, best1RM });

test("the first session is never a record", () => {
  const flags = markRecords([session(1, "2026-01-05", 60, 70)]);
  assert.equal(flags.size, 0);
});

test("flags only sessions that beat every earlier one", () => {
  const flags = markRecords([
    session(1, "2026-01-05", 60, 70),
    session(2, "2026-01-12", 65, 76), // both improved
    session(3, "2026-01-19", 60, 72), // lighter, worse 1RM than session 2
    session(4, "2026-01-26", 70, 80), // both improved again
  ]);

  assert.deepEqual([...flags.keys()], [2, 4]);
  assert.deepEqual(flags.get(2), { weight: true, oneRm: true });
  assert.deepEqual(flags.get(4), { weight: true, oneRm: true });
});

test("more reps at the same weight is a 1RM record but not a weight record", () => {
  const flags = markRecords([
    session(1, "2026-02-02", 80, 96), // 80kg × 6
    session(2, "2026-02-09", 80, 101.3), // 80kg × 8
  ]);

  assert.deepEqual(flags.get(2), { weight: false, oneRm: true });
  assert.equal(describeRecord(flags.get(2)!), "Recorde de 1RM estimado");
});

test("a heavier single with fewer reps is a weight record only", () => {
  const flags = markRecords([
    session(1, "2026-03-02", 80, 101.3), // 80kg × 8
    session(2, "2026-03-09", 90, 96), // 90kg × 2
  ]);

  assert.deepEqual(flags.get(2), { weight: true, oneRm: false });
  assert.equal(describeRecord(flags.get(2)!), "Recorde de peso");
});

test("matching a previous best is not a record", () => {
  const flags = markRecords([
    session(1, "2026-04-01", 100, 120),
    session(2, "2026-04-08", 100, 120),
  ]);
  assert.equal(flags.size, 0);
});

test("input order does not matter", () => {
  const shuffled = markRecords([
    session(3, "2026-01-19", 70, 80),
    session(1, "2026-01-05", 60, 70),
    session(2, "2026-01-12", 65, 76),
  ]);
  assert.deepEqual([...shuffled.keys()].sort(), [2, 3]);
});

test("two sessions on the same day resolve by workout id", () => {
  const flags = markRecords([
    session(5, "2026-05-04", 60, 70),
    session(6, "2026-05-04", 65, 76),
  ]);
  assert.deepEqual([...flags.keys()], [6]);
});

test("isRecord and describeRecord cover both kinds at once", () => {
  assert.equal(isRecord(undefined), false);
  assert.equal(isRecord({ weight: false, oneRm: false }), false);
  assert.equal(isRecord({ weight: true, oneRm: false }), true);
  assert.equal(
    describeRecord({ weight: true, oneRm: true }),
    "Recorde de peso e de 1RM estimado",
  );
});
