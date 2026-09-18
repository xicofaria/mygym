"use client";
/* eslint-disable @next/next/no-img-element -- attributed external product photos */
import { useState, type RefObject } from "react";
import { foodStores, productSchema, type FoodProduct } from "@/lib/nutrition";
import { fmt } from "./format";

export function OpenFoodFactsLookup({
  barcodeFieldRef,
  onError,
  onReview,
}: {
  barcodeFieldRef: RefObject<HTMLInputElement | null>;
  onError: (message: string) => void;
  onReview: (product: Partial<FoodProduct>, trigger: HTMLElement) => void;
}) {
  const [barcode, setBarcode] = useState("");
  const [external, setExternal] = useState<Partial<FoodProduct>[]>([]);
  const [searching, setSearching] = useState(false);
  const [externalNotice, setExternalNotice] = useState("");
  async function lookup(store?: string) {
    setSearching(true);
    onError("");
    setExternalNotice("");
    setExternal([]);
    try {
      const params = store
        ? "store=" + store
        : "barcode=" + encodeURIComponent(barcode.trim());
      const response = await fetch("/api/calories/products?" + params);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const rows = (Array.isArray(body.products) ? body.products : []).flatMap(
        (p: unknown) => {
          const parsed = productSchema.safeParse(p);
          return parsed.success ? [parsed.data] : [];
        },
      );
      setExternal(rows);
      if (!rows.length)
        setExternalNotice(
          "Sem resultados com calorias disponíveis. Fotografa o rótulo ou adiciona manualmente.",
        );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Pesquisa indisponível.");
    } finally {
      setSearching(false);
    }
  }
  return (
    <section className="border-t border-black/10 pt-4 dark:border-white/10">
      <h2 className="font-semibold">Encontrar no Open Food Facts</h2>
      <p className="my-2 text-xs text-zinc-500">
        Open Food Facts: catálogo colaborativo, não oficial das lojas. Dados
        ODbL; fotos CC BY-SA. Confirma marca, porção, unidade e rótulo atual.
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
      >
        <label className="label">
          Código de barras
          <input
            ref={barcodeFieldRef}
            className="input"
            inputMode="numeric"
            pattern="[0-9]{8,14}"
            required
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
        </label>
        <button className="btn-ghost" disabled={searching}>
          Consultar código
        </button>
      </form>
      <p className="mt-3 text-sm font-medium">Explorar exemplos por loja</p>
      <p className="my-1 text-xs text-zinc-600 dark:text-zinc-400">
        Mostra alguns produtos associados à loja no Open Food Facts. Não é o
        catálogo completo nem os preços da loja.
      </p>
      <div className="my-2 flex flex-wrap gap-2">
        {foodStores.map(([id, store]) => (
          <button
            className="btn-ghost"
            disabled={searching}
            key={store}
            onClick={() => void lookup(id)}
          >
            {store}
          </button>
        ))}
      </div>
      {searching && <p role="status">A consultar…</p>}
      {externalNotice && (
        <p role="status" className="text-sm">
          {externalNotice}
        </p>
      )}
      {external.map((p, i) => (
        <article
          key={i}
          className="flex items-center gap-3 border-t border-black/5 py-3 dark:border-white/10"
        >
          {p.imageUrl && (
            <img
              className="h-14 w-14 object-contain"
              src={p.imageUrl}
              alt={p.name}
              referrerPolicy="no-referrer"
            />
          )}
          <div className="flex-1">
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-zinc-500">
              {p.brand} · {fmt(p.nutrients!.kcal)} kcal / 100 {p.unit}
            </p>
            <a
              href={p.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline"
            >
              Ver fonte e fotografia
            </a>
          </div>
          <button
            className="btn-ghost"
            onClick={(event) => onReview(p, event.currentTarget)}
          >
            Rever
          </button>
        </article>
      ))}
    </section>
  );
}
