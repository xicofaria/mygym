"use client";
import {
  nutrientKeys,
  nutrientLabels,
  type FoodProduct,
  type NutritionReference,
} from "@/lib/nutrition";
import { NutritionReferenceEditor } from "../nutrition-reference";

type ProductDetails = FoodProduct["details"];

export function NutritionTable({
  unit,
  reference,
  values,
  fieldErrors,
  details,
  source,
  confirmed,
  onApplyReference,
  onValue,
  onConfirm,
}: {
  unit: "g" | "ml";
  reference: NutritionReference;
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  details: ProductDetails;
  source: string;
  confirmed: boolean;
  onApplyReference: (next: NutritionReference, convert: boolean) => void;
  onValue: (key: string, value: string) => void;
  onConfirm: (checked: boolean) => void;
}) {
  return (
    <>
      <h3 className="font-semibold">Tabela nutricional</h3>
      {details.packageQuantity !== null ? (
        <p aria-label="Peso da embalagem identificado" className="text-sm">
          Embalagem: {details.packageQuantity} {unit}
          {details.packageEstimated
            ? " — estimativa, confirmar"
            : " — identificado"}
          <span className="mt-1 block text-xs text-zinc-500">
            Guardado para calcular embalagens no diário, onde podes confirmar ou
            ajustar.
          </span>
        </p>
      ) : source.endsWith("-ai") ? (
        <p className="text-xs text-zinc-500">
          Peso da embalagem não identificado. Podes indicá-lo no diário;
          a quantidade usada na tabela não identifica, por si só, a embalagem inteira.
        </p>
      ) : null}
      <NutritionReferenceEditor
        reference={reference}
        hasValues={Object.values(values).some((v) => v.trim() !== "")}
        kcal={values.kcal}
        onApply={onApplyReference}
      />
      {reference.origin === "assumed" && (
        <p
          role="status"
          className="text-sm text-amber-700 dark:text-amber-300"
        >
          Base assumida: {reference.quantity} {unit}. Confirma antes de guardar.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {nutrientKeys.map((key) => (
          <label key={key} className="label">
            {nutrientLabels[key]}
            {key !== "kcal" && " (g)"}
            <input
              aria-label={`${nutrientLabels[key]} por ${reference.quantity}`}
              name={key}
              aria-invalid={Boolean(fieldErrors[key])}
              aria-describedby={
                fieldErrors[key] ? `food-error-${key}` : "nutrition-reference-summary"
              }
              className="input"
              inputMode="decimal"
              maxLength={12}
              required={key === "kcal"}
              placeholder="Desconhecido"
              value={values[key]}
              onChange={(e) => onValue(key, e.target.value)}
            />
            {fieldErrors[key] && (
              <span
                id={`food-error-${key}`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                {fieldErrors[key]}
              </span>
            )}
            {details.nutrientEstimates.includes(key) && (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Estimativa — confirmar
              </span>
            )}
          </label>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Quanto comeste? Indica unidades, gramas ou embalagens no diário, depois
        de guardar o produto.
      </p>
      {source !== "manual" && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => onConfirm(e.target.checked)}
          />
          Confirmei o produto, a base de {reference.quantity} {unit} e os
          valores {source === "estimate-ai" ? "estimados" : "sugeridos"}.
        </label>
      )}
    </>
  );
}
