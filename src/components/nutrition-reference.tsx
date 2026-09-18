"use client";
import { useState } from "react";
import { nutritionReferenceSchema, type NutritionReference } from "@/lib/nutrition";
import { parseWeight } from "@/lib/decimal";

export function NutritionReferenceEditor({ reference, hasValues, onApply }: {
  reference: NutritionReference;
  hasValues: boolean;
  onApply: (reference: NutritionReference, convert: boolean) => void;
}) {
  const [kind, setKind] = useState(reference.kind);
  const [quantity, setQuantity] = useState(String(reference.quantity));
  const [unit, setUnit] = useState(reference.unit);
  const [error, setError] = useState("");
  const changed = kind !== reference.kind || parseWeight(quantity) !== reference.quantity || unit !== reference.unit;
  function apply(convert: boolean) {
    const parsed = nutritionReferenceSchema.safeParse({ kind, quantity: kind === "standard" ? 100 : parseWeight(quantity), unit, origin: "manual" });
    if (!parsed.success) { setError("Indica uma quantidade superior a 0 e até 10 000 g/ml."); return; }
    setError("");
    onApply(parsed.data, convert);
  }
  return <fieldset className="flex flex-col gap-3 rounded-xl border border-black/10 p-3 dark:border-white/15">
    <legend className="px-1 text-sm font-medium">Os valores abaixo correspondem a:</legend>
    <label className="label">Base nutricional
      <select aria-label="Base nutricional" className="input" value={kind} onChange={(e) => {
        const next = e.target.value as NutritionReference["kind"];
        setKind(next);
        if (next === "standard") setQuantity("100");
      }}>
        <option value="standard">100 g / 100 ml</option>
        <option value="serving">Uma porção</option>
        <option value="package">Embalagem inteira</option>
        <option value="custom">Outra quantidade</option>
      </select>
    </label>
    <div className="grid grid-cols-2 gap-3">
      {kind !== "standard" && <label className="label">Quantidade de referência
        <input aria-label="Quantidade de referência" className="input" name="referenceQuantity" inputMode="decimal" value={quantity} aria-invalid={Boolean(error)} aria-describedby={error ? "reference-error" : undefined} onChange={(e) => setQuantity(e.target.value)} />
      </label>}
      <label className="label">Unidade da base
        <select aria-label="Valores por" className="input" value={unit} onChange={(e) => setUnit(e.target.value as "g" | "ml")}>
          <option value="g">{kind === "standard" ? "100 g" : "g"}</option>
          <option value="ml">{kind === "standard" ? "100 ml" : "ml"}</option>
        </select>
      </label>
    </div>
    {changed && <div className="flex flex-col gap-2" role="group" aria-label="Confirmar alteração da base">
      <p className="text-sm">A alteração só se aplica após escolheres como tratar os valores.</p>
      <button className="btn-ghost" type="button" onClick={() => apply(false)}>{hasValues ? "Manter os números e corrigir a base" : "Aplicar base"}</button>
      {hasValues && unit === reference.unit && <button className="btn-ghost" type="button" onClick={() => apply(true)}>Converter os valores para a nova quantidade</button>}
      {unit !== reference.unit && <p className="text-xs">Não existe conversão automática entre gramas e mililitros. Confirma a unidade do rótulo.</p>}
    </div>}
    {error && <p role="alert" id="reference-error" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
  </fieldset>;
}
