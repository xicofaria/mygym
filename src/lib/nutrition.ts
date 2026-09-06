import { z } from "zod";
import { isDateKey } from "./workout-calendar";

export const nutrientKeys = [
  "kcal",
  "protein",
  "carbs",
  "fat",
  "saturated",
  "sugars",
  "fiber",
  "salt",
] as const;
export const nutrientLabels: Record<(typeof nutrientKeys)[number], string> = {
  kcal: "Energia (kcal)",
  protein: "Proteína",
  carbs: "Hidratos",
  fat: "Gorduras",
  saturated: "Saturados",
  sugars: "Açúcares",
  fiber: "Fibra",
  salt: "Sal",
};
const nutrient = z.number().finite().min(0).max(100).nullable();
export const nutrientsSchema = z.object({
  kcal: z.number().finite().min(0).max(1000),
  protein: nutrient,
  carbs: nutrient,
  fat: nutrient,
  saturated: nutrient,
  sugars: nutrient,
  fiber: nutrient,
  salt: nutrient,
});
export type Nutrients = z.infer<typeof nutrientsSchema>;
export const emptyNutrients: Nutrients = {
  kcal: 0,
  protein: null,
  carbs: null,
  fat: null,
  saturated: null,
  sugars: null,
  fiber: null,
  salt: null,
};
export const photoSchema = z
  .string()
  .max(220000)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
  .nullable();
export const foodStores = [
  ["continente", "Continente"],
  ["lidl", "Lidl"],
  ["pingo-doce", "Pingo Doce"],
  ["mercadona", "Mercadona"],
  ["aldi", "Aldi"],
] as const;
const portionAmount = z.number().finite().positive().max(10000).nullable();
export const productDetailsSchema = z.object({
  packageQuantity: portionAmount,
  pieceQuantity: portionAmount,
  packageEstimated: z.boolean(),
  pieceEstimated: z.boolean(),
  nutrientEstimates: z.array(z.enum(nutrientKeys)).max(8),
});
export const emptyProductDetails: z.infer<typeof productDetailsSchema> = {
  packageQuantity: null,
  pieceQuantity: null,
  packageEstimated: false,
  pieceEstimated: false,
  nutrientEstimates: [],
};
export const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80),
  unit: z.enum(["g", "ml"]),
  nutrients: nutrientsSchema,
  details: productDetailsSchema.default(emptyProductDetails),
  source: z.enum(["manual", "label-ai", "estimate-ai", "openfoodfacts"]),
  sourceUrl: z.union([
    z.literal(""),
    z
      .string()
      .url()
      .max(300)
      .refine((url) =>
        /^https:\/\/world\.openfoodfacts\.org\/product\/\d+$/.test(url),
      ),
  ]),
  imageUrl: z.union([
    z.literal(""),
    z
      .string()
      .url()
      .max(500)
      .refine((url) => /^https:\/\/images\.openfoodfacts\.org\//.test(url)),
  ]),
});
export type FoodProduct = z.infer<typeof productSchema> & {
  id: number;
  hasPhoto: boolean;
};
export function portionQuantity(
  amount: number,
  mode: "weight" | "package" | "pieces",
  details: z.infer<typeof productDetailsSchema>,
) {
  const factor =
    mode === "weight"
      ? 1
      : mode === "package"
        ? details.packageQuantity
        : details.pieceQuantity;
  const quantity = factor === null ? NaN : amount * factor;
  return Number.isFinite(quantity) &&
    amount > 0 &&
    quantity > 0 &&
    quantity <= 10000
    ? quantity
    : NaN;
}
export const meals = ["Pequeno-almoço", "Almoço", "Jantar", "Lanches"] as const;
export const entryInputSchema = z.object({
  productId: z.number().int().positive(),
  date: z.string().refine(isDateKey),
  meal: z.enum(meals),
  quantity: z.number().finite().positive().max(10000),
});
export type FoodEntry = {
  id: number;
  productId: number | null;
  date: string;
  meal: string;
  quantity: number;
  snapshot: z.infer<typeof productSchema>;
};
export type CalorieGoal = {
  effectiveFrom: string;
  kcal: number;
  tolerance: number;
};
export function scaleNutrition(
  nutrients: Nutrients,
  quantity: number,
): Nutrients {
  return Object.fromEntries(
    nutrientKeys.map((key) => [
      key,
      nutrients[key] === null ? null : (nutrients[key] * quantity) / 100,
    ]),
  ) as Nutrients;
}
export function nutritionTotal(entries: FoodEntry[]) {
  const totals = {
    ...emptyNutrients,
    protein: 0,
    carbs: 0,
    fat: 0,
    saturated: 0,
    sugars: 0,
    fiber: 0,
    salt: 0,
  };
  const incomplete = new Set<string>();
  for (const entry of entries) {
    const scaled = scaleNutrition(entry.snapshot.nutrients, entry.quantity);
    for (const key of nutrientKeys) {
      if (scaled[key] === null) incomplete.add(key);
      else totals[key] += scaled[key];
    }
  }
  return { totals, incomplete: [...incomplete] };
}
export function goalForDate(goals: CalorieGoal[], date: string) {
  return (
    goals
      .filter((goal) => goal.effectiveFrom <= date)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null
  );
}
export function dayResult(
  kcal: number,
  goal: CalorieGoal | null,
  completed: boolean,
  hasEntries: boolean,
) {
  if (!hasEntries) return "Sem registos";
  if (!completed) return "Por completar";
  if (!goal) return "Sem meta";
  const margin = (goal.kcal * goal.tolerance) / 100;
  return kcal >= goal.kcal - margin && kcal <= goal.kcal + margin
    ? "Dentro da meta"
    : kcal < goal.kcal
      ? "Abaixo do intervalo"
      : "Acima do intervalo";
}
export function periodDates(date: string, period: "day" | "week" | "month") {
  const start = new Date(date + "T00:00:00Z");
  if (period === "week")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === "month") start.setUTCDate(1);
  const end = new Date(start);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 6);
  if (period === "month") {
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
  }
  const dates: string[] = [];
  for (
    const cursor = new Date(start);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  )
    dates.push(cursor.toISOString().slice(0, 10));
  return dates;
}
