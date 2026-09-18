"use client";
import type { Dispatch, RefObject } from "react";
import { meals, nutrientKeys, nutrientLabels } from "@/lib/nutrition";
import { DiaryPortion } from "../diary-portion";
import { fmt } from "./format";
import type {
  CalorieData,
  DraftAction,
  EntryDraft,
  QuantityMode,
  deriveEntry,
} from "./entry-draft";

export function EntryForm({
  products,
  draft,
  dispatch,
  derived,
  date,
  provider,
  pending,
  entryHeadingRef,
  onSubmit,
  onCancel,
  onCreateProduct,
}: {
  products: CalorieData["products"];
  draft: EntryDraft;
  dispatch: Dispatch<DraftAction>;
  derived: ReturnType<typeof deriveEntry>;
  date: string;
  provider: "openai" | "openrouter";
  pending: boolean;
  entryHeadingRef: RefObject<HTMLHeadingElement | null>;
  onSubmit: () => void;
  onCancel: () => void;
  onCreateProduct: (trigger: HTMLElement) => void;
}) {
  const { editing, repeating, productId, quantity, quantityMode, meal } = draft;
  const { snapshotEntry, chosen, portionKey, amount, preview } = derived;
  return (
    <form
      aria-label={
        editing
          ? `Editar consumo: ${editing.snapshot.name}`
          : "Adicionar ao diário"
      }
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2
        ref={entryHeadingRef}
        tabIndex={-1}
        className="font-semibold focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        {editing
          ? `Editar consumo: ${editing.snapshot.name}`
          : repeating
            ? `Repetir consumo: ${repeating.snapshot.name}`
            : "Adicionar ao diário"}
      </h2>
      {repeating && (
        <p
          role="status"
          className="text-sm text-indigo-700 dark:text-indigo-300"
        >
          Valores do registo de {repeating.date}. Confirma a quantidade e a
          refeição para {date}; ainda não foi registado.
        </p>
      )}
      <label className="label">
        Alimento
        <select
          aria-label="Alimento"
          className="input"
          required
          disabled={Boolean(repeating) || pending}
          value={productId}
          onChange={(e) =>
            dispatch({
              type: "choose",
              productId: e.target.value,
              packaged:
                products.find((p) => p.id === Number(e.target.value))?.details
                  .packageQuantity != null,
            })
          }
        >
          <option value="">Escolher produto</option>
          {snapshotEntry?.productId &&
            !products.some((p) => p.id === snapshotEntry.productId) && (
              <option value={snapshotEntry.productId}>
                {snapshotEntry.snapshot.name} (arquivado)
              </option>
            )}
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.brand ? " · " + p.brand : ""}
            </option>
          ))}
        </select>
      </label>
      {chosen && (
        <label className="label">
          Como queres registar?
          <select
            className="input"
            aria-label="Modo de quantidade"
            value={quantityMode}
            onChange={(e) =>
              dispatch({ type: "mode", value: e.target.value as QuantityMode })
            }
          >
            <option value="weight">Peso / volume ({chosen.unit})</option>
            <option value="package">Embalagens</option>
            <option value="pieces">Unidades</option>
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="label">
          {quantityMode === "weight"
            ? `Quantidade (${chosen?.unit ?? "g/ml"})`
            : quantityMode === "package"
              ? "N.º de embalagens"
              : "N.º de unidades"}
          <input
            className="input"
            aria-label="Quantidade consumida"
            inputMode="decimal"
            maxLength={12}
            required
            value={quantity}
            onChange={(e) =>
              dispatch({ type: "quantity", value: e.target.value })
            }
            placeholder={
              quantityMode === "package"
                ? "Ex.: 0,5 = metade"
                : quantityMode === "pieces"
                  ? "Ex.: 20 amendoins"
                  : "Ex.: 150"
            }
          />
        </label>
        <label className="label">
          Refeição
          <select
            className="input"
            value={meal}
            onChange={(e) => dispatch({ type: "meal", value: e.target.value })}
          >
            {meals.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      {quantityMode === "package" && (
        <div className="flex flex-wrap gap-2">
          {[
            ["0,25", "¼ embalagem"],
            ["0,5", "½ embalagem"],
            ["1", "1 embalagem"],
          ].map(([value, label]) => (
            <button
              type="button"
              className="btn-ghost"
              key={value}
              onClick={() => dispatch({ type: "quantity", value })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {chosen && quantityMode !== "weight" && (
        <DiaryPortion
          key={portionKey}
          productId={Number(productId)}
          mode={quantityMode}
          unit={chosen.unit}
          initialQuantity={
            quantityMode === "pieces"
              ? chosen.details.pieceQuantity
              : chosen.details.packageQuantity
          }
          initialEstimated={
            quantityMode === "pieces"
              ? chosen.details.pieceEstimated
              : chosen.details.packageEstimated
          }
          provider={provider}
          onChange={(value) =>
            dispatch({ type: "portion", value: { key: portionKey, ...value } })
          }
        />
      )}
      {preview && (
        <p role="status" className="text-sm text-indigo-700 dark:text-indigo-300">
          {fmt(preview.kcal)} kcal para{" "}
          {quantityMode === "weight" ? quantity : fmt(amount)} {chosen!.unit}
          {chosen!.source === "estimate-ai" ? " · estimativa" : ""}
        </p>
      )}
      {preview && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-500">
            Nutrientes desta quantidade
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            {nutrientKeys
              .filter((k) => k !== "kcal")
              .map((key) => (
                <div key={key}>
                  <dt className="text-xs text-zinc-500">
                    {nutrientLabels[key]}
                  </dt>
                  <dd>
                    {preview[key] === null
                      ? "Desconhecido"
                      : `${fmt(preview[key])} g`}
                  </dd>
                </div>
              ))}
          </dl>
        </details>
      )}
      <button
        className="btn-primary"
        disabled={pending || !productId || !Number.isFinite(amount)}
      >
        {editing
          ? "Guardar consumo"
          : repeating
            ? "Confirmar repetição"
            : "Registar consumo"}
      </button>
      {(editing || repeating) && (
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={onCancel}
        >
          {repeating ? "Cancelar repetição" : "Cancelar edição"}
        </button>
      )}
      <button
        type="button"
        className="btn-ghost"
        onClick={(event) => onCreateProduct(event.currentTarget)}
      >
        + Criar produto / fotografia
      </button>
    </form>
  );
}
