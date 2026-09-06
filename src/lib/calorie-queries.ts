import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { calorieGoals, foodDays, foodEntries, foodProducts } from "@/db/schema";
import {
  emptyProductDetails,
  productSchema,
  type FoodEntry,
  type FoodProduct,
} from "./nutrition";

export async function getCalorieData(
  userId: number,
  start: string,
  end: string,
) {
  const [products, entries, goals, days] = await Promise.all([
    db
      .select({
        id: foodProducts.id,
        name: foodProducts.name,
        brand: foodProducts.brand,
        unit: foodProducts.unit,
        nutrients: foodProducts.nutrients,
        details: foodProducts.details,
        source: foodProducts.source,
        sourceUrl: foodProducts.sourceUrl,
        imageUrl: foodProducts.imageUrl,
        hasPhoto: sql<boolean>`${foodProducts.photo} is not null`.mapWith(
          Boolean,
        ),
      })
      .from(foodProducts)
      .where(
        and(eq(foodProducts.userId, userId), eq(foodProducts.archived, false)),
      )
      .orderBy(asc(foodProducts.name)),
    db
      .select()
      .from(foodEntries)
      .where(
        and(
          eq(foodEntries.userId, userId),
          gte(foodEntries.date, start),
          lte(foodEntries.date, end),
        ),
      )
      .orderBy(desc(foodEntries.id)),
    db
      .select({
        effectiveFrom: calorieGoals.effectiveFrom,
        kcal: calorieGoals.kcal,
        tolerance: calorieGoals.tolerance,
      })
      .from(calorieGoals)
      .where(eq(calorieGoals.userId, userId))
      .orderBy(asc(calorieGoals.effectiveFrom)),
    db
      .select({ date: foodDays.date, completed: foodDays.completed })
      .from(foodDays)
      .where(
        and(
          eq(foodDays.userId, userId),
          gte(foodDays.date, start),
          lte(foodDays.date, end),
        ),
      ),
  ]);
  return {
    products: products.map((p) => ({
      ...productSchema.parse({
        ...p,
        nutrients: JSON.parse(p.nutrients),
        details: { ...emptyProductDetails, ...JSON.parse(p.details) },
      }),
      id: p.id,
      hasPhoto: p.hasPhoto,
    })) as FoodProduct[],
    entries: entries.map((e) => ({
      id: e.id,
      productId: e.productId,
      date: e.date,
      meal: e.meal,
      quantity: e.quantity,
      snapshot: productSchema.parse(JSON.parse(e.snapshot)),
    })) as FoodEntry[],
    goals,
    days,
  };
}
