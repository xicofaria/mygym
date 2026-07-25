import assert from "node:assert/strict";
import test from "node:test";
import { resolveViewedUserId } from "../../src/lib/viewer";

test("accepts an existing user id", () => {
  assert.equal(resolveViewedUserId("2", 1, [1, 2]), 2);
});

test("falls back to the signed-in user for unknown ids", () => {
  assert.equal(resolveViewedUserId("999", 1, [1, 2]), 1);
});

test("uses the first query value", () => {
  assert.equal(resolveViewedUserId(["2", "1"], 1, [1, 2]), 2);
});
