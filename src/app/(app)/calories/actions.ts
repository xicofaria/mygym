"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { calorieGoals, foodDays, foodEntries, foodProducts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  emptyProductDetails,
  entryInputSchema,
  photoSchema,
  productSchema,
} from "@/lib/nutrition";
import { isCurrentOrPastDateKey } from "@/lib/workout-calendar";
import { lisbonDateKey } from "@/lib/format";

const idSchema = z.number().int().positive();
function refresh() {
  revalidatePath("/calories");
}
const invalid = { error: "Verifica os dados introduzidos." };

export async function saveFoodProduct(input: unknown) {
  const user = await requireUser();
  const parsed = productSchema
    .extend({ id: idSchema.optional(), photo: photoSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return invalid;
  const { id, photo, nutrients, details, ...fields } = parsed.data;
  if (photo) {
    const bytes = Buffer.from(photo.split(",")[1], "base64");
    if (
      bytes.length > 160000 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[2] !== 255
    )
      return invalid;
  }
  const values = {
    ...fields,
    nutrients: JSON.stringify(nutrients),
    details: JSON.stringify(details),
    ...(photo !== undefined ? { photo } : {}),
  };
  const rows = id
    ? await db
        .update(foodProducts)
        .set(values)
        .where(and(eq(foodProducts.id, id), eq(foodProducts.userId, user.id)))
        .returning({ id: foodProducts.id })
    : await db
        .insert(foodProducts)
        .values({ ...values, userId: user.id })
        .returning({ id: foodProducts.id });
  refresh();
  return rows[0]
    ? { error: null, id: rows[0].id }
    : { error: "Produto não encontrado." };
}
export async function archiveFoodProduct(id: unknown) {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return invalid;
  await db
    .update(foodProducts)
    .set({ archived: true, photo: null })
    .where(
      and(eq(foodProducts.id, id as number), eq(foodProducts.userId, user.id)),
    );
  refresh();
  return { error: null };
}
export async function saveFoodEntry(input: unknown) {
  const user = await requireUser();
  const parsed = entryInputSchema
    .extend({ id: idSchema.optional() })
    .safeParse(input);
  if (!parsed.success || !isCurrentOrPastDateKey(parsed.data.date))
    return invalid;
  const { id, ...values } = parsed.data;
  const result = await db.transaction(async (tx) => {
    const previous = id
      ? await tx
          .select()
          .from(foodEntries)
          .where(and(eq(foodEntries.id, id), eq(foodEntries.userId, user.id)))
          .get()
      : null;
    if (id && !previous) return { error: "Registo não encontrado." };
    const product = await tx
      .select()
      .from(foodProducts)
      .where(
        and(
          eq(foodProducts.id, values.productId),
          eq(foodProducts.userId, user.id),
          eq(foodProducts.archived, false),
        ),
      )
      .get();
    // Same product on edit keeps the original nutritional snapshot.
    if (!product && previous?.productId !== values.productId)
      return { error: "Produto não encontrado." };
    const snapshot =
      previous?.productId === values.productId
        ? previous.snapshot
        : JSON.stringify(
            productSchema.parse({
              ...product,
              nutrients: JSON.parse(product!.nutrients),
              details: {
                ...emptyProductDetails,
                ...JSON.parse(product!.details),
              },
            }),
          );
    const row = { ...values, snapshot, userId: user.id };
    if (id)
      await tx
        .update(foodEntries)
        .set(row)
        .where(and(eq(foodEntries.id, id), eq(foodEntries.userId, user.id)));
    else await tx.insert(foodEntries).values(row);
    for (const date of new Set([
      values.date,
      ...(previous ? [previous.date] : []),
    ])) {
      await tx
        .insert(foodDays)
        .values({ userId: user.id, date, completed: false })
        .onConflictDoUpdate({
          target: [foodDays.userId, foodDays.date],
          set: { completed: false },
        });
    }
    return { error: null };
  });
  refresh();
  return result;
}
export async function deleteFoodEntry(id: unknown) {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return invalid;
  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(foodEntries)
      .where(
        and(eq(foodEntries.id, id as number), eq(foodEntries.userId, user.id)),
      )
      .returning({ date: foodEntries.date });
    if (removed[0])
      await tx
        .update(foodDays)
        .set({ completed: false })
        .where(
          and(eq(foodDays.userId, user.id), eq(foodDays.date, removed[0].date)),
        );
  });
  refresh();
  return { error: null };
}
export async function saveCalorieGoal(input: unknown) {
  const user = await requireUser();
  const parsed = z
    .object({
      kcal: z.number().finite().min(100).max(10000),
      tolerance: z.number().finite().min(0).max(30),
    })
    .safeParse(input);
  if (!parsed.success) return invalid;
  await db
    .insert(calorieGoals)
    .values({ userId: user.id, effectiveFrom: lisbonDateKey(), ...parsed.data })
    .onConflictDoUpdate({
      target: [calorieGoals.userId, calorieGoals.effectiveFrom],
      set: parsed.data,
    });
  refresh();
  return { error: null };
}
export async function setFoodDayComplete(date: unknown, completed: unknown) {
  const user = await requireUser();
  if (!isCurrentOrPastDateKey(date) || typeof completed !== "boolean")
    return invalid;
  const result = await db.transaction(async (tx) => {
    if (completed) {
      const any = await tx
        .select({ id: foodEntries.id })
        .from(foodEntries)
        .where(
          and(
            eq(foodEntries.userId, user.id),
            eq(foodEntries.date, date as string),
          ),
        )
        .get();
      if (!any) return { error: "Adiciona alimentos antes de concluir o dia." };
    }
    await tx
      .insert(foodDays)
      .values({ userId: user.id, date: date as string, completed })
      .onConflictDoUpdate({
        target: [foodDays.userId, foodDays.date],
        set: { completed },
      });
    return { error: null };
  });
  refresh();
  return result;
}
