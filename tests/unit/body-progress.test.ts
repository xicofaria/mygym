import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBodyProgress,
  deltaTone,
  rangeStart,
  readBodyFieldKey,
  readBodyRange,
  type BodyMetricInput,
} from "../../src/lib/body-progress";

const EMPTY = {
  heightCm: null,
  weightKg: null,
  bodyFatPct: null,
  waistCm: null,
  chestCm: null,
  armCm: null,
  thighCm: null,
  hipCm: null,
  notes: null,
};

let nextId = 1;
function metric(
  date: string,
  values: Partial<Omit<BodyMetricInput, "id" | "date">>,
): BodyMetricInput {
  return {
    id: nextId++,
    date: new Date(`${date}T00:00:00.000Z`),
    ...EMPTY,
    ...values,
  };
}

const TODAY = new Date("2026-07-30T00:00:00.000Z");
const FIXTURES: BodyMetricInput[] = [
  metric("2026-01-10", {
    weightKg: 88,
    waistCm: 95,
    armCm: 36,
    bodyFatPct: 22,
    heightCm: 178,
  }),
  metric("2026-06-20", { weightKg: 85, waistCm: 92, bodyFatPct: 20 }),
  metric("2026-07-10", { weightKg: 83.5, waistCm: 90, armCm: 37.5 }),
  metric("2026-07-28", {
    weightKg: 82.4,
    waistCm: 88.5,
    bodyFatPct: 17.2,
    notes: "pós-férias",
  }),
];

test("measures change against the last reading before the window", () => {
  const month = buildBodyProgress(FIXTURES, "30d", TODAY);
  const weight = month.fields.find((field) => field.key === "weightKg");

  assert.equal(weight?.latest, 82.4);
  // 85 kg on 20 Jun precedes the 30-day window and is the baseline for it.
  assert.equal(weight?.delta, -2.6);
  assert.deepEqual(weight?.points, [
    { date: "2026-06-20", value: 85 },
    { date: "2026-07-10", value: 83.5 },
    { date: "2026-07-28", value: 82.4 },
  ]);

  const everything = buildBodyProgress(FIXTURES, "all", TODAY);
  assert.equal(
    everything.fields.find((field) => field.key === "weightKg")?.delta,
    -5.6,
  );
});

test("a baseline older than the window still anchors sparse measures", () => {
  const month = buildBodyProgress(FIXTURES, "30d", TODAY);
  const arm = month.fields.find((field) => field.key === "armCm");

  // The arm was measured in January and again on 10 Jul — inside the window
  // there is a single point, so the January reading is what it grew from.
  assert.equal(arm?.latest, 37.5);
  assert.equal(arm?.delta, 1.5);
  assert.equal(arm?.points.length, 2);
});

test("omits measures that were never recorded and keeps a stable order", () => {
  const progress = buildBodyProgress(FIXTURES, "all", TODAY);
  assert.deepEqual(
    progress.fields.map((field) => field.key),
    ["weightKg", "bodyFatPct", "waistCm", "armCm"],
  );
});

test("derives BMI from the latest weight and the last recorded height", () => {
  const progress = buildBodyProgress(FIXTURES, "all", TODAY);
  assert.equal(progress.heightCm, 178);
  assert.equal(progress.bmi, 26);
  assert.equal(buildBodyProgress([], "all", TODAY).bmi, null);
});

test("history rows carry deltas against the previous entry with that measure", () => {
  const progress = buildBodyProgress(FIXTURES, "30d", TODAY);

  assert.equal(progress.measurementCount, 2);
  assert.equal(progress.totalCount, 4);
  assert.deepEqual(
    progress.history.map((row) => row.date.toISOString().slice(0, 10)),
    ["2026-07-28", "2026-07-10"],
  );

  const [latest, previous] = progress.history;
  assert.deepEqual(latest?.cells.weightKg, { value: 82.4, delta: -1.1 });
  // Body fat was skipped on 10 Jul, so it compares back to 20 Jun.
  assert.deepEqual(latest?.cells.bodyFatPct, { value: 17.2, delta: -2.8 });
  assert.equal(latest?.notes, "pós-férias");
  assert.deepEqual(previous?.cells.armCm, { value: 37.5, delta: 1.5 });
  assert.equal(previous?.cells.bodyFatPct, undefined);
});

test("a single measurement has a value but nothing to compare against", () => {
  const progress = buildBodyProgress(
    [metric("2026-07-28", { weightKg: 80 })],
    "all",
    TODAY,
  );
  const weight = progress.fields[0];

  assert.equal(weight?.latest, 80);
  assert.equal(weight?.delta, null);
  assert.deepEqual(progress.history[0]?.cells.weightKg, {
    value: 80,
    delta: null,
  });
});

test("uses insertion order for multiple measurements on the same day", () => {
  const older = metric("2026-07-28", { weightKg: 81 });
  const newer = metric("2026-07-28", { weightKg: 80 });
  const progress = buildBodyProgress([newer, older], "all", TODAY);

  assert.equal(
    progress.fields.find((field) => field.key === "weightKg")?.latest,
    80,
  );
  assert.deepEqual(
    progress.history.map((row) => row.id),
    [newer.id, older.id],
  );
  assert.equal(progress.history[0]?.cells.weightKg?.delta, -1);
});

test("anchors ranges in Lisbon and excludes future measurements", () => {
  const instant = new Date("2026-07-31T23:30:00.000Z"); // 1 Aug in Lisbon
  const progress = buildBodyProgress(
    [
      metric("2026-07-01", { weightKg: 90 }),
      metric("2026-07-02", { weightKg: 89 }),
      metric("2026-08-01", { weightKg: 88 }),
      metric("2026-08-02", { weightKg: 50 }),
    ],
    "30d",
    instant,
  );

  assert.equal(rangeStart("30d", instant)?.toISOString().slice(0, 10), "2026-07-02");
  assert.equal(progress.measurementCount, 2);
  assert.equal(
    progress.fields.find((field) => field.key === "weightKg")?.latest,
    88,
  );
  assert.equal(progress.totalCount, 3);
});

test("tone follows each measure's goal, not the sign of the change", () => {
  assert.equal(deltaTone(-2, "down"), "good");
  assert.equal(deltaTone(2, "down"), "bad");
  assert.equal(deltaTone(2, "up"), "good");
  assert.equal(deltaTone(-2, "up"), "bad");
  assert.equal(deltaTone(-2, "neutral"), "neutral");
  assert.equal(deltaTone(0, "down"), "neutral");
  assert.equal(deltaTone(null, "down"), "neutral");
});

test("query parameters fall back to safe defaults", () => {
  assert.equal(readBodyRange("30d"), "30d");
  assert.equal(readBodyRange(["1y", "30d"]), "1y");
  assert.equal(readBodyRange("semana"), "3m");
  assert.equal(readBodyRange(undefined), "3m");
  assert.equal(readBodyFieldKey("waistCm"), "waistCm");
  assert.equal(readBodyFieldKey("passwordHash"), null);
  assert.equal(readBodyFieldKey(undefined), null);
});
