import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthCalendar,
  isMonthKey,
  monthGridRange,
  monthKeyOf,
  readMonthKey,
} from "../../src/lib/month-calendar";
import { dateFromKey } from "../../src/lib/workout-calendar";

test("renders full Monday-based weeks padded with adjacent months", () => {
  const calendar = buildMonthCalendar(
    "2026-07",
    [dateFromKey("2026-07-15"), dateFromKey("2026-07-15")],
    [dateFromKey("2026-07-20"), dateFromKey("2026-08-01")],
    dateFromKey("2026-07-15"),
  );

  assert.equal(calendar.month, "2026-07");
  assert.equal(calendar.previousMonth, "2026-06");
  assert.equal(calendar.nextMonth, "2026-08");
  assert.equal(calendar.weeks.length, 5);
  assert.ok(calendar.weeks.every((week) => week.length === 7));

  const days = calendar.weeks.flat();
  assert.equal(days[0]?.date, "2026-06-29");
  assert.equal(days[0]?.inMonth, false);
  assert.equal(days.at(-1)?.date, "2026-08-02");
  assert.equal(days.at(-1)?.inMonth, false);
  assert.equal(days.filter((day) => day.inMonth).length, 31);

  assert.deepEqual(
    days.find((day) => day.date === "2026-07-15"),
    {
      date: "2026-07-15",
      dayOfMonth: 15,
      inMonth: true,
      isToday: true,
      isFuture: false,
      workoutCount: 2,
      plannedCount: 0,
    },
  );
  assert.deepEqual(
    days.find((day) => day.date === "2026-07-20"),
    {
      date: "2026-07-20",
      dayOfMonth: 20,
      inMonth: true,
      isToday: false,
      isFuture: true,
      workoutCount: 0,
      plannedCount: 1,
    },
  );
  // A plan on a padding day of the next month still shows in this grid.
  assert.equal(
    days.find((day) => day.date === "2026-08-01")?.plannedCount,
    1,
  );
});

test("month navigation crosses year boundaries", () => {
  const january = buildMonthCalendar("2026-01", [], [], dateFromKey("2026-01-10"));
  assert.equal(january.previousMonth, "2025-12");
  assert.equal(january.nextMonth, "2026-02");
});

test("grid range covers the first Monday through the Sunday after month end", () => {
  assert.deepEqual(monthGridRange("2026-07"), {
    from: "2026-06-29",
    to: "2026-08-03",
  });
  assert.deepEqual(monthGridRange("2026-02"), {
    from: "2026-01-26",
    to: "2026-03-02",
  });
});

test("accepts only real YYYY-MM month keys from query parameters", () => {
  assert.equal(isMonthKey("2026-07"), true);
  assert.equal(isMonthKey("2026-13"), false);
  assert.equal(isMonthKey("2026-7"), false);
  assert.equal(isMonthKey("2026-07-01"), false);
  assert.equal(readMonthKey(["2026-07", "2026-08"]), "2026-07");
  assert.equal(readMonthKey("julho"), null);
  assert.equal(readMonthKey(undefined), null);
  assert.equal(monthKeyOf(dateFromKey("2026-07-15")), "2026-07");
  assert.throws(() => buildMonthCalendar("2026-13", [], []), RangeError);
});
