/** Shared formatting + small fitness math helpers (safe to import anywhere). */

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
  });
}

export function fmtShortDate(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

/** Value of <input type="date"> for a given Date. */
export function toDateInputValue(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
