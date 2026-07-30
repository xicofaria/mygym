import assert from "node:assert/strict";
import test from "node:test";
import {
  formatGroupNames,
  normalizeGroupName,
  normalizeGroupNames,
} from "../../src/lib/muscle-groups";
import {
  isRestDay,
  planRoutineApplication,
  weekdayOf,
  type RoutineDay,
} from "../../src/lib/routine";
import { dateFromKey } from "../../src/lib/workout-calendar";
import { monthDateKeys } from "../../src/lib/month-calendar";

// 2026-08: Sat 1st … Mon 31st.
const ROUTINE: RoutineDay[] = [
  { weekday: 1, groups: ["Peito", "Tríceps", "Ombros"] },
  { weekday: 2, groups: ["Dorsal", "Bíceps"] },
  { weekday: 3, groups: ["Pernas"] },
  { weekday: 5, groups: ["Peito", "Ombros"] },
  { weekday: 6, groups: ["Cardio", "Abdominais"] },
];

test("maps dates to ISO weekdays with Monday first", () => {
  assert.equal(weekdayOf(dateFromKey("2026-08-03")), 1);
  assert.equal(weekdayOf(dateFromKey("2026-08-08")), 6);
  assert.equal(weekdayOf(dateFromKey("2026-08-09")), 7);
});

test("a weekday with no groups is a rest day", () => {
  assert.equal(isRestDay(ROUTINE, 4), true);
  assert.equal(isRestDay(ROUTINE, 7), true);
  assert.equal(isRestDay(ROUTINE, 1), false);
});

test("applying a routine fills only future, unplanned days", () => {
  const created = planRoutineApplication({
    month: "2026-08",
    routine: ROUTINE,
    existingPlanDates: ["2026-08-12"],
    today: dateFromKey("2026-08-10"),
  });
  const dates = created.map((entry) => entry.date);

  // Nothing before today, even though 3 Aug is a Monday in the routine.
  assert.ok(dates.every((date) => date >= "2026-08-10"));
  assert.equal(dates.includes("2026-08-03"), false);
  // 12 Aug is a Wednesday but already had a plan, so it is left alone.
  assert.equal(dates.includes("2026-08-12"), false);
  // Thursdays and Sundays are rest days.
  assert.equal(dates.includes("2026-08-13"), false);
  assert.equal(dates.includes("2026-08-16"), false);

  assert.deepEqual(created[0], {
    date: "2026-08-10",
    groups: ["Peito", "Tríceps", "Ombros"],
  });
  assert.deepEqual(created.at(-1), {
    date: "2026-08-31",
    groups: ["Peito", "Tríceps", "Ombros"],
  });
});

test("applying twice in a row creates nothing the second time", () => {
  const args = {
    month: "2026-08" as const,
    routine: ROUTINE,
    today: dateFromKey("2026-08-10"),
  };
  const first = planRoutineApplication({ ...args, existingPlanDates: [] });
  const second = planRoutineApplication({
    ...args,
    existingPlanDates: first.map((entry) => entry.date),
  });

  assert.ok(first.length > 0);
  assert.deepEqual(second, []);
});

test("an empty routine plans nothing at all", () => {
  assert.deepEqual(
    planRoutineApplication({
      month: "2026-08",
      routine: [],
      existingPlanDates: [],
      today: dateFromKey("2026-08-01"),
    }),
    [],
  );
});

test("enumerates every day of a month, including leap February", () => {
  assert.equal(monthDateKeys("2026-08").length, 31);
  assert.equal(monthDateKeys("2026-02").length, 28);
  assert.equal(monthDateKeys("2028-02").length, 29);
  assert.equal(monthDateKeys("2026-08")[0], "2026-08-01");
  assert.equal(monthDateKeys("2026-08").at(-1), "2026-08-31");
});

test("group names are trimmed, de-duplicated and capped", () => {
  assert.equal(normalizeGroupName("  peito   grande "), "peito grande");
  assert.equal(normalizeGroupName("   "), null);
  assert.deepEqual(
    normalizeGroupNames(["Peito", " peito ", "", "Tríceps"]),
    ["Peito", "Tríceps"],
  );
  assert.equal(
    normalizeGroupNames(Array.from({ length: 20 }, (_, i) => `G${i}`)).length,
    8,
  );
  assert.equal(normalizeGroupName("x".repeat(50))?.length, 30);
  assert.equal(formatGroupNames(["Peito", "Ombros"]), "Peito · Ombros");
});
