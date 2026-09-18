"use client";
/* eslint-disable @next/next/no-img-element -- private endpoints and attributed product photos */
import { useState, type RefObject } from "react";
import type { FoodProduct } from "@/lib/nutrition";
import { fmt } from "./format";
import { OpenFoodFactsLookup } from "./open-food-facts";
import type { CalorieData } from "./entry-draft";

export function ProductCatalogue({
  products,
  pending,
  catalogueButtonRef,
  barcodeFieldRef,
  onOpenProduct,
  onBarcode,
  onConsume,
  onArchive,
  onError,
}: {
  products: CalorieData["products"];
  pending: boolean;
  catalogueButtonRef: RefObject<HTMLButtonElement | null>;
  barcodeFieldRef: RefObject<HTMLInputElement | null>;
  onOpenProduct: (
    product: Partial<FoodProduct>,
    trigger: HTMLElement,
    manual?: boolean,
  ) => void;
  onBarcode: () => void;
  onConsume: (product: FoodProduct) => void;
  onArchive: (product: FoodProduct) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [addMethods, setAddMethods] = useState(false);
  const filtered = products.filter((p) =>
    (p.name + " " + p.brand)
      .toLocaleLowerCase("pt")
      .includes(search.toLocaleLowerCase("pt")),
  );
  return (
    <>
      <button
        type="button"
        ref={catalogueButtonRef}
        className="btn-primary self-start"
        aria-expanded={addMethods}
        onClick={() => setAddMethods(!addMethods)}
      >
        + Novo produto
      </button>
      {addMethods && (
        <section
          aria-label="Como adicionar produto"
          className="flex flex-col gap-2 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <h2 className="font-semibold">Como queres adicionar?</h2>
          <button
            className="btn-ghost"
            onClick={(event) => onOpenProduct({}, event.currentTarget, true)}
          >
            Preencher manualmente
          </button>
          <button
            className="btn-ghost"
            onClick={(event) => onOpenProduct({}, event.currentTarget)}
          >
            Fotografar rótulo / alimento
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setAddMethods(false);
              onBarcode();
            }}
          >
            Introduzir código de barras
          </button>
        </section>
      )}
      {products.length > 0 && (
        <label className="label">
          Pesquisar no meu catálogo
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou marca"
          />
        </label>
      )}
      <div className="divide-y divide-black/10 dark:divide-white/10">
        {filtered.map((p) => (
          <article key={p.id} aria-label={p.name} className="flex gap-3 py-3">
            {(p.hasPhoto || p.imageUrl) && (
              <img
                className="h-16 w-16 rounded-lg object-contain"
                src={p.hasPhoto ? `/api/calories/photos/${p.id}` : p.imageUrl}
                alt={p.name}
                referrerPolicy="no-referrer"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-zinc-500">
                {p.brand} · {fmt(p.nutrients.kcal)} kcal / 100 {p.unit}
              </p>
              {p.sourceUrl && (
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline"
                >
                  Open Food Facts · ODbL / foto CC BY-SA
                </a>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => onConsume(p)}>
                  Consumir
                </button>
                <button
                  className="btn-ghost"
                  onClick={(event) => onOpenProduct(p, event.currentTarget)}
                >
                  Editar produto
                </button>
                <button
                  className="btn-ghost"
                  disabled={pending}
                  onClick={() => onArchive(p)}
                >
                  Arquivar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!products.length && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ainda não tens produtos. Cria o primeiro manualmente, por fotografia
          ou código de barras.
        </p>
      )}
      {products.length > 0 && !filtered.length && (
        <p
          role="status"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Nenhum produto corresponde a «{search}». Usa «Novo produto» para o
          adicionar.
        </p>
      )}
      <OpenFoodFactsLookup
        barcodeFieldRef={barcodeFieldRef}
        onError={onError}
        onReview={onOpenProduct}
      />
    </>
  );
}
