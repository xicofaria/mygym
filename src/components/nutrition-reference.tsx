"use client";
import { useRef, useState } from "react";
import { nutritionReferenceSchema, type NutritionReference } from "@/lib/nutrition";
import { parseWeight } from "@/lib/decimal";

const format = (value: number) => new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 4 }).format(value);
const describe = (reference: NutritionReference) =>
  `${reference.kind === "serving" ? "porção de " : reference.kind === "package" ? "embalagem de " : ""}${format(reference.quantity)} ${reference.unit}`;
const draftOf = (reference: NutritionReference) => ({
  original: reference, kind: reference.kind, quantity: String(reference.quantity), unit: reference.unit,
});

export function NutritionReferenceEditor({ reference, hasValues, kcal, onApply }: {
  reference: NutritionReference;
  hasValues: boolean;
  kcal: string;
  onApply: (reference: NutritionReference, convert: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(reference));
  const selector = useRef<HTMLSelectElement>(null);
  // AI/import can replace the reference. Own edits retain the exact input string
  // (including a trailing decimal separator), without remounting a focused input.
  if (draft.original !== reference) setDraft(draftOf(reference));
  const { kind, quantity, unit } = draft;
  const parsed = nutritionReferenceSchema.safeParse({ kind, quantity: kind === "standard" ? 100 : parseWeight(quantity), unit, origin: "manual" });
  const changed = !parsed.success || kind !== reference.kind || parsed.data.quantity !== reference.quantity || unit !== reference.unit;
  const energy = parseWeight(kcal);
  const canConvert = parsed.success && unit === reference.unit;
  const quantityLabel = kind === "package" ? "Conteúdo da embalagem" : kind === "serving" ? (unit === "ml" ? "Volume da porção" : "Peso da porção") : "Quantidade no rótulo";

  function change(next: typeof draft) {
    const result = nutritionReferenceSchema.safeParse({ kind: next.kind, quantity: next.kind === "standard" ? 100 : parseWeight(next.quantity), unit: next.unit, origin: "manual" });
    if (!hasValues && result.success) {
      setDraft({ ...next, original: result.data });
      onApply(result.data, false);
    } else setDraft(next);
  }
  function apply(convert: boolean) {
    if (!parsed.success || (convert && !canConvert)) return;
    setDraft({ ...draft, original: parsed.data });
    onApply(parsed.data, convert);
    selector.current?.focus();
  }
  return <fieldset data-reference-pending={changed ? "true" : undefined} className="flex flex-col gap-3 rounded-xl border border-black/10 p-3 dark:border-white/15">
    <legend className="px-1 text-sm font-medium">Valores do rótulo</legend>
    <label className="label">No rótulo, os valores são por…
      <select ref={selector} aria-label="No rótulo, os valores são por…" className="input" value={kind} onChange={(e) => {
        const next = e.target.value as NutritionReference["kind"];
        change({ ...draft, kind: next, quantity: next === "standard" ? "100" : kind === "standard" ? "" : quantity });
      }}>
        <option value="standard">100 {unit}</option>
        <option value="serving">Uma porção</option>
        <option value="package">Embalagem inteira</option>
        <option value="custom">Outra quantidade</option>
      </select>
    </label>
    <div className="grid grid-cols-2 gap-3">
      {kind !== "standard" && <label className="label">{quantityLabel}
        <input aria-label={quantityLabel} className="input" name="referenceQuantity" inputMode="decimal" maxLength={12} value={quantity} aria-invalid={!parsed.success} aria-describedby={!parsed.success ? "reference-error" : undefined} onChange={(e) => change({ ...draft, quantity: e.target.value })} />
      </label>}
      <label className="label">Unidade
        <select aria-label="Unidade do rótulo" className="input" value={unit} onChange={(e) => change({ ...draft, unit: e.target.value as "g" | "ml" })}>
          <option value="g">g</option>
          <option value="ml">ml</option>
        </select>
      </label>
    </div>
    {!parsed.success && <p id="reference-error" className="text-sm text-red-600 dark:text-red-400">Indica uma quantidade superior a 0 e até 10 000 {unit} para continuar.</p>}
    {changed && hasValues && <div className="flex flex-col gap-2" role="group" aria-label="Confirmar alteração da base">
      <p className="text-sm">Já existem nutrientes preenchidos. Queres converter os valores ou corrigir a quantidade a que correspondem?</p>
      {parsed.success && <>
        {canConvert && <button className="btn-ghost" type="button" onClick={() => apply(true)}>Converter os valores</button>}
        {canConvert && Number.isFinite(energy) && <p className="text-xs">Ao converter: {format(energy)} kcal por {describe(reference)} → {format(energy * (parsed.data.quantity / reference.quantity))} kcal por {describe(parsed.data)}.</p>}
        <button className="btn-ghost" type="button" onClick={() => apply(false)}>Manter os números do rótulo</button>
        <p className="text-xs">{Number.isFinite(energy) ? `Mantém ${format(energy)} kcal` : "Mantém os nutrientes introduzidos"}, agora por {describe(parsed.data)}. Usa esta opção para corrigir a quantidade ou unidade indicada.</p>
      </>}
      {unit !== reference.unit && <p className="text-xs">Não existe conversão automática entre gramas e mililitros. Confirma a unidade do rótulo.</p>}
      <button className="btn-ghost" type="button" onClick={() => { setDraft(draftOf(reference)); selector.current?.focus(); }}>Cancelar alteração</button>
    </div>}
    <p id="nutrition-reference-summary" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">
      {changed ? hasValues
        ? `Alteração por confirmar. Os nutrientes ainda correspondem a ${describe(reference)}.`
        : "Indica a quantidade do rótulo antes de preencher os nutrientes."
        : `Valores nutricionais por ${describe(reference)}.`}
    </p>
  </fieldset>;
}
