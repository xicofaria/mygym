"use client";
import { useReducer } from "react";
import { parseWeight } from "@/lib/decimal";
import type { getCalorieData } from "@/lib/calorie-queries";
import {
  meals,
  portionQuantity,
  scaleNutrition,
  type FoodEntry,
} from "@/lib/nutrition";

export type CalorieData = Awaited<ReturnType<typeof getCalorieData>>;
export type QuantityMode = "weight" | "package" | "pieces";
type PortionOverride = {
  key: string;
  unitQuantity: number;
  estimated: boolean;
} | null;

/** Everything the diary form needs, and that the catalogue and the product editor also write to. */
export type EntryDraft = {
  productId: string;
  quantity: string;
  quantityMode: QuantityMode;
  meal: string;
  editing: FoodEntry | null;
  repeating: FoodEntry | null;
  portionOverride: PortionOverride;
};

export type DraftAction =
  | { type: "reset" }
  | { type: "choose"; productId: string; packaged: boolean }
  | { type: "consume"; productId: string; packaged: boolean }
  | { type: "edit"; entry: FoodEntry }
  | { type: "repeat"; entry: FoodEntry }
  | { type: "quantity"; value: string }
  | { type: "mode"; value: QuantityMode }
  | { type: "meal"; value: string }
  | { type: "portion"; value: PortionOverride };

const initial: EntryDraft = {
  productId: "",
  quantity: "",
  quantityMode: "weight",
  meal: meals[0],
  editing: null,
  repeating: null,
  portionOverride: null,
};

export function draftReducer(
  state: EntryDraft,
  action: DraftAction,
): EntryDraft {
  switch (action.type) {
    case "reset":
      return {
        ...state,
        productId: "",
        quantity: "",
        quantityMode: "weight",
        editing: null,
        repeating: null,
        portionOverride: null,
      };
    // Picking in the select keeps an edit in progress; consuming starts a new entry.
    case "choose":
      return {
        ...state,
        productId: action.productId,
        portionOverride: null,
        quantityMode: action.packaged ? "package" : "weight",
        quantity: action.packaged ? "1" : "",
      };
    case "consume":
      return {
        ...state,
        productId: action.productId,
        portionOverride: null,
        quantityMode: action.packaged ? "package" : "weight",
        quantity: action.packaged ? "1" : "",
        editing: null,
        repeating: null,
      };
    case "edit":
      return {
        ...state,
        editing: action.entry,
        repeating: null,
        portionOverride: null,
        quantityMode: "weight",
        productId: String(action.entry.productId),
        quantity: String(action.entry.quantity),
        meal: action.entry.meal,
      };
    case "repeat":
      return {
        ...state,
        repeating: action.entry,
        editing: null,
        portionOverride: null,
        productId: String(action.entry.productId),
        quantityMode: "weight",
        quantity: String(action.entry.quantity),
        meal: action.entry.meal,
      };
    case "quantity":
      return { ...state, quantity: action.value };
    case "mode":
      return {
        ...state,
        quantityMode: action.value,
        portionOverride: null,
        quantity: "",
      };
    case "meal":
      return { ...state, meal: action.value };
    case "portion":
      return { ...state, portionOverride: action.value };
  }
}

export function useEntryDraft() {
  return useReducer(draftReducer, initial);
}

/**
 * An edited or repeated entry reads from its immutable snapshot, so archiving or
 * editing the catalogue product never rewrites what was already recorded.
 */
export function deriveEntry(draft: EntryDraft, products: CalorieData["products"]) {
  const snapshotEntry = draft.editing ?? draft.repeating;
  const chosen =
    snapshotEntry?.productId === Number(draft.productId)
      ? snapshotEntry.snapshot
      : products.find((p) => p.id === Number(draft.productId));
  const portionKey = `${draft.productId}:${snapshotEntry?.id ?? "new"}:${draft.quantityMode}`;
  const override =
    draft.portionOverride?.key === portionKey ? draft.portionOverride : null;
  const details = chosen
    ? {
        ...chosen.details,
        ...(override
          ? draft.quantityMode === "pieces"
            ? {
                pieceQuantity: override.unitQuantity,
                pieceEstimated: override.estimated,
              }
            : {
                packageQuantity: override.unitQuantity,
                packageEstimated: override.estimated,
              }
          : {}),
      }
    : null;
  const amount = details
    ? portionQuantity(parseWeight(draft.quantity), draft.quantityMode, details)
    : NaN;
  const preview =
    chosen && Number.isFinite(amount) && amount > 0
      ? scaleNutrition(chosen.nutrients, amount)
      : null;
  return { snapshotEntry, chosen, portionKey, details, amount, preview };
}
