import { z } from "zod";
import { parseWeight } from "./decimal";
import { isDateKey } from "./workout-calendar";

export const BODY_METRIC_FIELDS = [
  { key: "weightKg", label: "Peso (kg)", max: 500 },
  { key: "bodyFatPct", label: "Gordura corporal (%)", max: 80 },
  { key: "waistCm", label: "Cintura (cm)", max: 300 },
  { key: "chestCm", label: "Peito (cm)", max: 300 },
  { key: "armCm", label: "Braço (cm)", max: 150 },
  { key: "thighCm", label: "Coxa (cm)", max: 200 },
  { key: "hipCm", label: "Anca (cm)", max: 300 },
  { key: "heightCm", label: "Altura (cm)", max: 300 },
] as const;

function optionalDecimal(max: number, allowZero = false) {
  const number = allowZero
    ? z.number().min(0).max(max)
    : z.number().positive().max(max);
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    return value.trim() === "" ? undefined : parseWeight(value);
  }, number.optional());
}

/** Empty optional fields are absent; malformed nonempty fields reject the whole entry. */
export const bodyMetricInputSchema = z
  .object({
    date: z.string().refine(isDateKey),
    weightKg: optionalDecimal(500),
    heightCm: optionalDecimal(300),
    waistCm: optionalDecimal(300),
    chestCm: optionalDecimal(300),
    armCm: optionalDecimal(150),
    thighCm: optionalDecimal(200),
    hipCm: optionalDecimal(300),
    bodyFatPct: optionalDecimal(80, true),
    notes: z.string().max(500).optional(),
  })
  .refine((value) => BODY_METRIC_FIELDS.some(({ key }) => value[key] != null), {
    message: "Introduz pelo menos uma medida.",
  });
