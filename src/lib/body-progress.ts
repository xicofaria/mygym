import { round } from "./format";

/**
 * Pure progress math for the body page: how each measurement changed over a
 * selected time range, plus per-entry deltas for the history table.
 */

export const BODY_RANGES = ["30d", "3m", "1y", "all"] as const;
export type BodyRange = (typeof BODY_RANGES)[number];
export const DEFAULT_BODY_RANGE: BodyRange = "3m";

export const BODY_RANGE_LABELS: Record<BodyRange, string> = {
  "30d": "30 dias",
  "3m": "3 meses",
  "1y": "1 ano",
  all: "Tudo",
};

/** Whether a rising value is progress, falling is progress, or it depends. */
export type BodyGoal = "down" | "up" | "neutral";

export type BodyFieldKey =
  | "weightKg"
  | "bodyFatPct"
  | "waistCm"
  | "chestCm"
  | "armCm"
  | "thighCm"
  | "hipCm";

export type BodyFieldDef = {
  key: BodyFieldKey;
  label: string;
  unit: string;
  goal: BodyGoal;
};

/**
 * Bodyweight and hips are deliberately `neutral`: whether they should rise or
 * fall depends on whether you are cutting or bulking, so we show the number
 * without judging its direction.
 */
export const BODY_FIELDS: readonly BodyFieldDef[] = [
  { key: "weightKg", label: "Peso", unit: "kg", goal: "neutral" },
  { key: "bodyFatPct", label: "Gordura", unit: "%", goal: "down" },
  { key: "waistCm", label: "Cintura", unit: "cm", goal: "down" },
  { key: "chestCm", label: "Peito", unit: "cm", goal: "up" },
  { key: "armCm", label: "Braço", unit: "cm", goal: "up" },
  { key: "thighCm", label: "Coxa", unit: "cm", goal: "up" },
  { key: "hipCm", label: "Anca", unit: "cm", goal: "neutral" },
];

export type BodyMetricInput = {
  id: number;
  date: Date;
  notes: string | null;
  heightCm: number | null;
} & { [K in BodyFieldKey]: number | null };

export type BodyFieldProgress = BodyFieldDef & {
  latest: number;
  /** Change across the selected range; null when there is nothing to compare. */
  delta: number | null;
  points: { date: string; value: number }[];
};

export type BodyHistoryCell = {
  value: number;
  /** Change from the previous entry that recorded this field. */
  delta: number | null;
};

export type BodyHistoryRow = {
  id: number;
  date: Date;
  notes: string | null;
  cells: Partial<Record<BodyFieldKey, BodyHistoryCell>>;
};

export type BodyProgress = {
  range: BodyRange;
  fields: BodyFieldProgress[];
  heightCm: number | null;
  bmi: number | null;
  measurementCount: number;
  totalCount: number;
  history: BodyHistoryRow[];
};

export function isBodyRange(value: unknown): value is BodyRange {
  return (
    typeof value === "string" &&
    (BODY_RANGES as readonly string[]).includes(value)
  );
}

export function readBodyRange(
  value: string | string[] | undefined,
): BodyRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isBodyRange(candidate) ? candidate : DEFAULT_BODY_RANGE;
}

export function isBodyFieldKey(value: unknown): value is BodyFieldKey {
  return BODY_FIELDS.some((field) => field.key === value);
}

export function readBodyFieldKey(
  value: string | string[] | undefined,
): BodyFieldKey | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isBodyFieldKey(candidate) ? candidate : null;
}

/** Inclusive lower bound of a range; null means "no lower bound". */
export function rangeStart(range: BodyRange, today: Date): Date | null {
  if (range === "all") return null;
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (range === "30d") start.setUTCDate(start.getUTCDate() - 30);
  else if (range === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start;
}

/** Whether a change moves toward the field's goal, for colouring. */
export function deltaTone(
  delta: number | null,
  goal: BodyGoal,
): "good" | "bad" | "neutral" {
  if (delta == null || delta === 0 || goal === "neutral") return "neutral";
  return (goal === "down" ? delta < 0 : delta > 0) ? "good" : "bad";
}

export function bmiOf(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const heightM = heightCm / 100;
  return round(weightKg / (heightM * heightM), 1);
}

export function buildBodyProgress(
  metrics: readonly BodyMetricInput[],
  range: BodyRange = DEFAULT_BODY_RANGE,
  today: Date = new Date(),
): BodyProgress {
  const ascending = [...metrics].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const start = rangeStart(range, today);
  const inRange = (date: Date) =>
    start == null || date.getTime() >= start.getTime();

  const fields: BodyFieldProgress[] = [];
  for (const def of BODY_FIELDS) {
    const values = ascending
      .filter((metric) => metric[def.key] != null)
      .map((metric) => ({
        date: metric.date,
        value: metric[def.key] as number,
      }));
    if (values.length === 0) continue;

    // Compare against the last reading before the window so a range shows the
    // real change over it, not just the spread of the points inside it.
    let baselineIndex = 0;
    for (let i = 0; i < values.length; i += 1) {
      if (inRange(values[i].date)) break;
      baselineIndex = i;
    }
    const baseline = values[baselineIndex];
    const latest = values[values.length - 1];

    fields.push({
      ...def,
      latest: latest.value,
      delta:
        baseline === latest ? null : round(latest.value - baseline.value, 1),
      points: values.slice(baselineIndex).map((point) => ({
        date: point.date.toISOString().slice(0, 10),
        value: point.value,
      })),
    });
  }

  const seen = new Map<BodyFieldKey, number>();
  const rows: BodyHistoryRow[] = ascending.map((metric) => {
    const cells: Partial<Record<BodyFieldKey, BodyHistoryCell>> = {};
    for (const def of BODY_FIELDS) {
      const value = metric[def.key];
      if (value == null) continue;
      const previous = seen.get(def.key);
      cells[def.key] = {
        value,
        delta: previous == null ? null : round(value - previous, 1),
      };
      seen.set(def.key, value);
    }
    return {
      id: metric.id,
      date: metric.date,
      notes: metric.notes,
      cells,
    };
  });

  const heightCm =
    ascending.filter((metric) => metric.heightCm != null).at(-1)?.heightCm ??
    null;
  const latestWeight = fields.find((field) => field.key === "weightKg")?.latest;

  return {
    range,
    fields,
    heightCm,
    bmi:
      latestWeight != null && heightCm != null
        ? bmiOf(latestWeight, heightCm)
        : null,
    measurementCount: ascending.filter((metric) => inRange(metric.date)).length,
    totalCount: ascending.length,
    history: rows.filter((row) => inRange(row.date)).reverse(),
  };
}
