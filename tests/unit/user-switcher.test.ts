import assert from "node:assert/strict";
import test from "node:test";
import { supportsViewedUser } from "../../src/components/user-switcher";

test("shows the user switcher only on pages that honour ?user", () => {
  for (const pathname of [
    "/dashboard",
    "/workouts",
    "/body",
    "/exercises",
    "/exercises/42",
  ]) {
    assert.equal(supportsViewedUser(pathname), true, pathname);
  }
});

test("hides the user switcher on write and configuration pages", () => {
  for (const pathname of [
    "/workouts/new",
    "/workouts/42/edit",
    "/workouts/routine",
    "/workouts/templates",
    "/exercises/new",
  ]) {
    assert.equal(supportsViewedUser(pathname), false, pathname);
  }
});
