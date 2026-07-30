/** Shared formatting + small fitness math helpers (safe to import anywhere). */

/** The civil time zone used by the app for user-facing dates. */
export const APP_TIME_ZONE = "Europe/Lisbon";

const lisbonDateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Calendar day in Lisbon for a real instant.
 *
 * This is deliberately separate from the UTC conversion used for dates read
 * from the database, which are already stored as normalised UTC midnights.
 */
export function lisbonDateKey(instant: Date = new Date()): string {
  if (Number.isNaN(instant.getTime())) throw new RangeError("Data inválida.");

  const parts = lisbonDateParts.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new RangeError("Data inválida.");
  return `${year}-${month}-${day}`;
}

/** Calendar month in Lisbon for a real instant. */
export function lisbonMonthKey(instant: Date = new Date()): string {
  return lisbonDateKey(instant).slice(0, 7);
}

/** Estimated 1-rep max via the Epley formula. */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function fmtDate(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtShortDate(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Value of <input type="date"> for an instant, using Lisbon's civil day. */
export function toDateInputValue(instant: Date = new Date()): string {
  return lisbonDateKey(instant);
}
