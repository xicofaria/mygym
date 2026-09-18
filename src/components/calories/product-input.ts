import type { ZodError } from "zod";
import { parseWeight } from "@/lib/decimal";
import {
  emptyNutrients,
  nutrientKeys,
  nutrientLabels,
  type Nutrients,
  type NutritionReference,
} from "@/lib/nutrition";

type NutrientKey = (typeof nutrientKeys)[number];

/** An empty field means unknown, never zero — except energy, which is required. */
export function nutrientsFromFields(values: Record<string, string>): Nutrients {
  const nutrients = { ...emptyNutrients };
  for (const key of nutrientKeys)
    nutrients[key] = (
      values[key].trim() === "" && key !== "kcal"
        ? null
        : parseWeight(values[key])
    ) as never;
  return nutrients;
}

/**
 * Turns schema issues into messages next to the field that caused them.
 * Limits are quoted in the reference the person is typing in, not per 100.
 */
export function productFieldErrors(
  error: ZodError,
  reference: NutritionReference,
  unit: "g" | "ml",
) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const nutrientIndex = issue.path.indexOf("nutrients");
    const key =
      nutrientIndex >= 0
        ? String(issue.path[nutrientIndex + 1])
        : String(issue.path[0]);
    if (nutrientKeys.includes(key as NutrientKey)) {
      const max = reference.quantity * (key === "kcal" ? 10 : 1);
      errors[key] =
        `${nutrientLabels[key as NutrientKey]}: indica um valor entre 0 e ${max} ${key === "kcal" ? "kcal" : "g"} por ${reference.quantity} ${unit}. Usa ponto ou vírgula.${key !== "kcal" ? " Se desconhecido, deixa vazio." : ""}`;
    } else if (key === "name")
      errors.name = "Indica o nome do alimento (1 a 120 caracteres).";
    else if (key === "brand")
      errors.brand = "A marca / loja pode ter até 80 caracteres.";
  }
  return errors;
}
