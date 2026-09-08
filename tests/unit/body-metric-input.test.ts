import assert from "node:assert/strict";
import test from "node:test";
import { bodyMetricInputSchema } from "../../src/lib/body-metric-input";

test("body metrics preserve comma/dot precision and optional blanks", () => {
  const value = bodyMetricInputSchema.parse({
    date: "2026-09-08",
    weightKg: "72,55",
    waistCm: "80.125",
    heightCm: " ",
    bodyFatPct: "0",
  });
  assert.equal(value.weightKg, 72.55);
  assert.equal(value.waistCm, 80.125);
  assert.equal(value.heightCm, undefined);
  assert.equal(value.bodyFatPct, 0);
});

test("a malformed or out-of-range measurement rejects the entire entry", () => {
  for (const bad of [
    "abc",
    "1,2.3",
    "0x10",
    "1e2",
    "Infinity",
    null,
    -1,
    0,
    501,
    Infinity,
    NaN,
  ]) {
    assert.equal(
      bodyMetricInputSchema.safeParse({
        date: "2026-09-08",
        weightKg: bad,
        waistCm: 80,
      }).success,
      false,
      String(bad),
    );
  }
  for (const [key, max] of Object.entries({
    heightCm: 300,
    waistCm: 300,
    chestCm: 300,
    armCm: 150,
    thighCm: 200,
    hipCm: 300,
    bodyFatPct: 80,
  })) {
    assert.equal(
      bodyMetricInputSchema.safeParse({ date: "2026-09-08", [key]: max })
        .success,
      true,
      key,
    );
    assert.equal(
      bodyMetricInputSchema.safeParse({ date: "2026-09-08", [key]: max + 0.1 })
        .success,
      false,
      key,
    );
  }
  assert.equal(
    bodyMetricInputSchema.safeParse({ date: "2026-09-08", weightKg: " " })
      .success,
    false,
  );
});
