import assert from "node:assert/strict";
import test from "node:test";
import { parseWeight } from "../../src/lib/decimal";

test("weights accept comma and dot without rounding", () => {
  for (const value of ["2.8", "2,8", " 2,8 "])
    assert.equal(parseWeight(value), 2.8);
  assert.equal(parseWeight("2.75"), 2.75);
  assert.equal(parseWeight("0"), 0);
  assert.equal(parseWeight(",5"), 0.5);
});
test("empty, ambiguous and non-decimal weights stay invalid", () => {
  for (const value of [
    "",
    " ",
    "1,2.3",
    "-1",
    "Infinity",
    "NaN",
    "0xff",
    "2e3",
    "2kg",
    "1 200",
    "2.",
  ]) {
    assert.ok(Number.isNaN(parseWeight(value)), value);
  }
});
