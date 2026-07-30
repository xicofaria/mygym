import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkoutCalendar,
  dateFromKey,
  isCurrentOrPastDateKey,
  isDateKey,
  isPlannableDateKey,
  readDateKey,
} from "../../src/lib/workout-calendar";

test("builds Monday-based weeks and counts only visible, non-future workouts", () => {
  const calendar = buildWorkoutCalendar(
    [
      dateFromKey("2026-07-19"),
      dateFromKey("2026-07-20"),
      dateFromKey("2026-07-20"),
      dateFromKey("2026-07-29"),
      dateFromKey("2026-07-30"),
    ],
    dateFromKey("2026-07-29"),
    2,
  );

  assert.equal(calendar.startDate, "2026-07-20");
  assert.equal(calendar.endDate, "2026-07-29");
  assert.equal(calendar.weeks.length, 2);
  assert.ok(calendar.weeks.every((week) => week.days.length === 7));
  assert.equal(calendar.totalWorkouts, 3);
  assert.equal(calendar.activeDays, 2);
  assert.equal(calendar.maxCount, 2);

  const days = calendar.weeks.flatMap((week) => week.days);
  assert.deepEqual(
    days.find((day) => day.date === "2026-07-20"),
    {
      date: "2026-07-20",
      count: 2,
      intensity: 2,
      isFuture: false,
    },
  );
  assert.deepEqual(
    days.find((day) => day.date === "2026-07-30"),
    {
      date: "2026-07-30",
      count: 0,
      intensity: 0,
      isFuture: true,
    },
  );
  assert.equal(calendar.weeks[0]?.monthStart, "2026-07-20");
  assert.equal(calendar.weeks[1]?.monthStart, "2026-08-01");
});

test("caps visual intensity at four workouts", () => {
  const date = dateFromKey("2026-07-29");
  const calendar = buildWorkoutCalendar(
    Array.from({ length: 5 }, () => date),
    date,
    1,
  );
  const activeDay = calendar.weeks[0]?.days.find((day) => day.count > 0);

  assert.equal(activeDay?.count, 5);
  assert.equal(activeDay?.intensity, 4);
  assert.equal(calendar.maxCount, 5);
});

test("uses Lisbon's civil day when the current instant crosses UTC midnight", () => {
  const calendar = buildWorkoutCalendar(
    [dateFromKey("2026-07-31")],
    new Date("2026-07-30T23:30:00.000Z"),
    1,
  );
  const day = calendar.weeks
    .flatMap((week) => week.days)
    .find((entry) => entry.date === "2026-07-31");

  assert.equal(calendar.endDate, "2026-07-31");
  assert.equal(day?.isFuture, false);
  assert.equal(day?.count, 1);
});

test("accepts only real ISO calendar dates from query parameters", () => {
  assert.equal(isDateKey("2026-02-28"), true);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("29-07-2026"), false);
  assert.equal(readDateKey(["2026-07-29", "2026-07-30"]), "2026-07-29");
  assert.equal(readDateKey("invalid"), null);
  assert.throws(() => dateFromKey("2026-02-30"), RangeError);
});

test("compares planning and recording dates with Lisbon's civil day", () => {
  const instant = new Date("2026-07-30T23:30:00.000Z");

  assert.equal(isPlannableDateKey("2026-07-30", instant), false);
  assert.equal(isPlannableDateKey("2026-07-31", instant), true);
  assert.equal(isCurrentOrPastDateKey("2026-07-31", instant), true);
  assert.equal(isCurrentOrPastDateKey("2026-08-01", instant), false);
  assert.equal(isPlannableDateKey("2026-02-30", instant), false);
});
