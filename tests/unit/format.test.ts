import assert from "node:assert/strict";
import test from "node:test";
import {
  lisbonDateKey,
  lisbonMonthKey,
  toDateInputValue,
} from "../../src/lib/format";

test("uses Lisbon's civil date around summer midnight", () => {
  assert.equal(
    lisbonDateKey(new Date("2026-07-30T22:59:59.999Z")),
    "2026-07-30",
  );
  assert.equal(
    lisbonDateKey(new Date("2026-07-30T23:00:00.000Z")),
    "2026-07-31",
  );
  assert.equal(
    toDateInputValue(new Date("2026-08-31T23:30:00.000Z")),
    "2026-09-01",
  );
  assert.equal(
    lisbonMonthKey(new Date("2026-08-31T23:30:00.000Z")),
    "2026-09",
  );
});

test("keeps the civil date through both Lisbon DST transitions", () => {
  assert.equal(
    lisbonDateKey(new Date("2026-03-29T00:30:00.000Z")),
    "2026-03-29",
  );
  assert.equal(
    lisbonDateKey(new Date("2026-03-29T01:30:00.000Z")),
    "2026-03-29",
  );
  assert.equal(
    lisbonDateKey(new Date("2026-10-25T00:30:00.000Z")),
    "2026-10-25",
  );
  assert.equal(
    lisbonDateKey(new Date("2026-10-25T01:30:00.000Z")),
    "2026-10-25",
  );
});

test("rejects invalid instants", () => {
  assert.throws(() => lisbonDateKey(new Date(Number.NaN)), RangeError);
});
