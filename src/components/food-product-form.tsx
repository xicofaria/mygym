"use client";
/* eslint-disable @next/next/no-img-element -- private JPEG endpoints and attributed external product images */
import { useEffect, useRef, useState, useTransition } from "react";
import { saveFoodProduct } from "@/app/(app)/calories/actions";
import {
  emptyNutrients,
  emptyProductDetails,
  foodStores,
  nutrientKeys,
  nutrientLabels,
  productSchema,
  type FoodProduct,
} from "@/lib/nutrition";
import { parseWeight } from "@/lib/decimal";
import { preparePhoto } from "@/lib/prepare-photo";
import { AIThinking } from "./ai-thinking";

export function FoodProductForm({
  initial,
  provider,
  onSaved,
  onCancel,
}: {
  initial?: Partial<FoodProduct>;
  provider: string;
  onSaved: (id: number, product: Pick<FoodProduct, "details">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [unit, setUnit] = useState<"g" | "ml">(initial?.unit ?? "g");
  const [details, setDetails] = useState(
    initial?.details ?? emptyProductDetails,
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      nutrientKeys.map((k) => [
        k,
        initial?.nutrients?.[k] == null ? "" : String(initial.nutrients[k]),
      ]),
    ),
  );
  const [source, setSource] = useState(initial?.source ?? "manual");
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mode, setMode] = useState("estimate");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(true);
  const [pending, start] = useTransition();
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );

  async function choose(file?: File) {
    if (!file) return;
    const current = ++generation.current;
    request.current?.abort();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const prepared = await preparePhoto(file);
      const thumb = await preparePhoto(file, {
        maxSide: 512,
        maxBytes: 140000,
      });
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Não foi possível ler a foto."));
        reader.readAsDataURL(thumb);
      });
      if (current !== generation.current) return;
      setBlob(prepared);
      setPhoto(data);
    } catch {
      if (current === generation.current)
        setError("Escolhe uma fotografia JPEG, PNG ou WebP até 20 MB.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function analyze() {
    if (!blob) return;
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setAnalyzing(true);
    setPhotoExpanded(false);
    setError("");
    setConfirmed(false);
    try {
      const response = await fetch("/api/calories/recognize", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "image/jpeg", "x-food-mode": mode },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(130000),
        ]),
      });
      const body = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error(body.error || "Análise indisponível.");
      setNotice(
        typeof body.explanation === "string"
          ? body.explanation
          : "Confirma os valores.",
      );
      if (!body.product) {
        setPhotoExpanded(true);
        return;
      }
      const data = productSchema.parse({
        ...body.product,
        source: mode === "label" ? "label-ai" : "estimate-ai",
        sourceUrl: "",
        imageUrl: "",
      });
      setName(data.name);
      setBrand(data.brand);
      setUnit(data.unit);
      setDetails(data.details);
      setSource(data.source);
      setPhotoExpanded(false);
      setValues(
        Object.fromEntries(
          nutrientKeys.map((k) => [
            k,
            data.nutrients[k] === null ? "" : String(data.nutrients[k]),
          ]),
        ),
      );
    } catch (e) {
      if (current === generation.current) {
        setPhotoExpanded(true);
        setError(e instanceof Error ? e.message : "Não foi possível analisar.");
      }
    } finally {
      if (current === generation.current) {
        setBusy(false);
        setAnalyzing(false);
      }
    }
  }
  function cancelAnalysis() {
    generation.current++;
    request.current?.abort();
    setBusy(false);
    setAnalyzing(false);
    setPhotoExpanded(true);
    setNotice(
      "Análise cancelada. A fotografia e os campos foram mantidos; uma chamada já enviada pode ser cobrada.",
    );
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const nutrients = { ...emptyNutrients };
    for (const key of nutrientKeys)
      nutrients[key] = (
        values[key].trim() === "" && key !== "kcal"
          ? null
          : parseWeight(values[key])
      ) as never;
    const parsed = productSchema.safeParse({
      name,
      brand,
      unit,
      nutrients,
      details,
      source,
      sourceUrl: source === "openfoodfacts" ? (initial?.sourceUrl ?? "") : "",
      imageUrl: photo !== undefined ? "" : (initial?.imageUrl ?? ""),
    });
    if (!parsed.success) {
      setError(
        "Preenche as kcal e verifica os valores por 100 g/ml. Campos desconhecidos podem ficar vazios.",
      );
      return;
    }
    if (source !== "manual" && !confirmed) {
      setError("Confirma os valores sugeridos antes de guardar.");
      return;
    }
    start(async () => {
      try {
        const result = await saveFoodProduct({
          ...parsed.data,
          id: initial?.id,
          photo,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if ("id" in result) onSaved(result.id, parsed.data);
      } catch {
        setError(
          "Sem ligação. Mantivemos os dados neste formulário; tenta guardar novamente.",
        );
      }
    });
  }
  const preview =
    photo === null
      ? ""
      : (photo ??
        (initial?.hasPhoto
          ? `/api/calories/photos/${initial.id}`
          : initial?.imageUrl));
  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-4"
      aria-label="Produto alimentar"
    >
      <h2 className="text-lg font-semibold">
        {initial?.id ? "Editar produto" : "Adicionar produto"}
      </h2>
      <details
        className="border-b border-black/10 pb-4 dark:border-white/10"
        open={photoExpanded}
        onToggle={(e) => setPhotoExpanded(e.currentTarget.open)}
      >
        <summary className="mb-3 min-h-8 cursor-pointer text-sm font-medium">
          {photoExpanded
            ? "Fotografia do produto ou rótulo"
            : "Fotografia e análise · ver ou alterar"}
        </summary>
        <label className="btn-ghost relative flex min-h-12 cursor-pointer items-center justify-center focus-within:ring-2 focus-within:ring-indigo-500">
          {preview ? "Substituir fotografia" : "Adicionar fotografia"}
          <input
            aria-label="Escolher fotografia do alimento"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || pending}
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <p className="mt-2 text-xs text-zinc-500">
          Usa a câmara ou a galeria nas opções do telemóvel. Fotografa o rótulo
          para maior precisão.
        </p>
        {preview && (
          <img
            src={preview}
            alt="Fotografia do produto"
            className="my-3 h-40 w-full rounded-lg object-contain"
            referrerPolicy="no-referrer"
          />
        )}
        {(preview || blob) && (
          <button
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={() => {
              generation.current++;
              request.current?.abort();
              setPhoto(null);
              setBlob(null);
              setBusy(false);
              setAnalyzing(false);
            }}
          >
            Remover fotografia
          </button>
        )}
        {blob && (
          <>
            <label className="label mt-2">
              Tipo de análise
              <select
                className="input"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                disabled={busy}
              >
                <option value="estimate">
                  Preencher com IA (permite estimativas)
                </option>
                <option value="label">Só valores legíveis do rótulo</option>
              </select>
            </label>
            <p className="my-2 text-xs text-zinc-500">
              Ao analisar, a fotografia segue para{" "}
              {provider === "openrouter"
                ? "OpenRouter e o fornecedor do modelo"
                : "OpenAI"}
              . Evita pessoas. A foto reduzida será guardada no teu catálogo
              apenas ao guardar o produto.
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || pending}
              onClick={() => void analyze()}
            >
              {busy ? "A preparar/analisar…" : "Analisar alimento"}
            </button>
          </>
        )}
      </details>
      {analyzing && <AIThinking food onCancel={cancelAnalysis} />}
      {notice && (
        <p
          role="status"
          className="text-sm text-indigo-700 dark:text-indigo-300"
        >
          {notice}
        </p>
      )}
      <label className="label">
        Nome do alimento
        <input
          className="input"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="label">
        Marca / loja
        <input
          className="input"
          maxLength={80}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Ex.: Continente, Pingo Doce, Mercadona"
          list="food-store-suggestions"
        />
      </label>
      <datalist id="food-store-suggestions">
        {foodStores.map(([id, label]) => (
          <option key={id} value={label} />
        ))}
      </datalist>
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
          Peso da embalagem não identificado. Podes indicá-lo no diário; a base
          por 100 g/ml não é o peso da embalagem.
        </p>
      ) : null}
      <label className="label">
        Valores por
        <select
          aria-label="Valores por"
          className="input"
          value={unit}
          onChange={(e) => setUnit(e.target.value as "g" | "ml")}
        >
          <option value="g">100 g</option>
          <option value="ml">100 ml</option>
        </select>
      </label>
      <p className="text-xs text-zinc-500">
        Esta base é sempre 100 g/ml, não o tamanho da embalagem. A IA preenche o
        que conseguir; revê os valores estimados e completa os desconhecidos.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {nutrientKeys.map((key) => (
          <label key={key} className="label">
            {nutrientLabels[key]}
            {key !== "kcal" && " (g)"}
            <input
              aria-label={`${nutrientLabels[key]} por 100`}
              className="input"
              inputMode="decimal"
              maxLength={12}
              required={key === "kcal"}
              placeholder="Desconhecido"
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
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
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Confirmei o produto, a base por 100 g/ml e os valores{" "}
          {source === "estimate-ai" ? "estimados" : "sugeridos"}.
        </label>
      )}
      {initial?.sourceUrl && (
        <p className="text-xs text-zinc-500">
          Fonte:{" "}
          <a
            className="underline"
            href={initial.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Food Facts
          </a>{" "}
          · dados ODbL · fotografias CC BY-SA. Confirma sempre a embalagem
          atual.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={pending || busy}>
          {pending ? "A guardar…" : "Guardar produto"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
