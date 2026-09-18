"use client";
import { useRef, useState } from "react";
import { saveFoodProduct } from "@/app/(app)/calories/actions";
import {
  emptyNutrients,
  emptyProductDetails,
  foodStores,
  nutrientKeys,
  productSchema,
  productInputSchema,
  nutrientsAtReference,
  type NutritionReference,
  type FoodProduct,
} from "@/lib/nutrition";
import { parseWeight } from "@/lib/decimal";
import { useAction } from "@/lib/use-action";
import { NutritionTable } from "./calories/nutrition-table";
import {
  nutrientsFromFields,
  productFieldErrors,
} from "./calories/product-input";
import { ProductCandidates } from "./calories/product-candidates";
import { ProductPhotoSection } from "./calories/product-photo-section";
import { useUnsavedGuard } from "./calories/use-unsaved-guard";
import {
  usePhotoAnalysis,
  type AnalyzedProduct,
  type ProductCandidate,
} from "./calories/use-photo-analysis";

// Normalizing to 100 g/ml leaves float noise (0.104 becomes 0.10400000000000001),
// so the fields show a decimal the person could have typed themselves.
const showNutrient = (value: number) => String(Math.round(value * 1e4) / 1e4);

const standardReference = (unit: "g" | "ml"): NutritionReference => ({
  kind: "standard",
  quantity: 100,
  unit,
  origin: "manual",
});

export function FoodProductForm({
  initial,
  provider,
  onSaved,
  onCancel,
}: {
  initial?: Partial<FoodProduct>;
  provider: "openai" | "openrouter";
  onSaved: (id: number, product: Pick<FoodProduct, "details">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [unit, setUnit] = useState<"g" | "ml">(initial?.unit ?? "g");
  const [reference, setReference] = useState<NutritionReference>(
    initial?.details?.nutritionReference ?? standardReference(initial?.unit ?? "g"),
  );
  const [nutritionChanged, setNutritionChanged] = useState(false);
  const [details, setDetails] = useState(
    initial?.details ?? emptyProductDetails,
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      nutrientKeys.map((k) => [
        k,
        initial?.nutrients?.[k] == null
          ? ""
          : showNutrient(
              nutrientsAtReference(initial.nutrients, reference.quantity)[k]!,
            ),
      ]),
    ),
  );
  const [source, setSource] = useState(initial?.source ?? "manual");
  const [candidates, setCandidates] = useState<ProductCandidate[]>([]);
  const [chosen, setChosen] = useState<ProductCandidate | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);
  const { pending, error, setError, run } = useAction(
    "Sem ligação. Mantivemos os dados neste formulário; tenta guardar novamente.",
  );
  useUnsavedGuard(dirtyRef, "Sair e descartar as alterações deste produto?");

  function applyAnalysis(data: AnalyzedProduct) {
    setName(data.name);
    setBrand(data.brand);
    setUnit(data.unit);
    setDetails(data.details);
    const next =
      data.details.nutritionReference ?? standardReference(data.unit);
    setReference(next);
    setNutritionChanged(true);
    setSource(data.source);
    setValues(
      Object.fromEntries(
        nutrientKeys.map((k) => [
          k,
          data.nutrients[k] === null
            ? ""
            : showNutrient(nutrientsAtReference(data.nutrients, next.quantity)[k]!),
        ]),
      ),
    );
  }
  const photoAnalysis = usePhotoAnalysis({
    pending,
    dirtyRef,
    onError: setError,
    onNotice: setNotice,
    onCandidates: setCandidates,
    onInvalidate: () => {
      setCandidates([]);
      setChosen(null);
      setConfirmed(false);
    },
    onProduct: applyAnalysis,
  });
  const { photo, busy } = photoAnalysis;

  function applyCandidate(candidate: ProductCandidate) {
    const parsed = productSchema.safeParse({
      name: candidate.name,
      brand: candidate.brand ?? "",
      unit: candidate.unit,
      nutrients: candidate.nutrients,
      details: candidate.details ?? emptyProductDetails,
      source: "openfoodfacts",
      sourceUrl: candidate.sourceUrl ?? "",
      imageUrl: candidate.imageUrl ?? "",
    });
    if (!parsed.success) {
      setError("Correspondência inválida; preenche ou confirma manualmente.");
      return;
    }
    setChosen(parsed.data);
    setSource("openfoodfacts");
    setName(parsed.data.name);
    setBrand(parsed.data.brand);
    setUnit(parsed.data.unit);
    setDetails(parsed.data.details);
    setReference(standardReference(parsed.data.unit));
    setNutritionChanged(true);
    setValues(
      Object.fromEntries(
        nutrientKeys.map((key) => [
          key,
          parsed.data.nutrients[key] === null
            ? ""
            : String(parsed.data.nutrients[key]),
        ]),
      ),
    );
    setConfirmed(false);
    setCandidates([]);
    photoAnalysis.setPhotoExpanded(false);
    setNotice(
      "Correspondência Open Food Facts aplicada. Confirma o produto e os valores antes de guardar.",
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (
      formRef.current?.querySelector('[data-reference-pending="true"]')
    ) {
      formRef.current
        .querySelector<HTMLElement>(
          '[data-reference-pending="true"] [aria-invalid="true"], [data-reference-pending="true"] button',
        )
        ?.focus();
      return;
    }
    setFieldErrors({});
    const nutrients = nutrientsFromFields(values);
    const input = {
      name,
      brand,
      unit,
      nutrients:
        !nutritionChanged && initial?.nutrients
          ? initial.nutrients
          : emptyNutrients,
      nutritionInput:
        !nutritionChanged && initial?.nutrients
          ? undefined
          : { reference, nutrients },
      details,
      source,
      sourceUrl:
        source === "openfoodfacts"
          ? (chosen?.sourceUrl ?? initial?.sourceUrl ?? "")
          : "",
      imageUrl:
        photo !== undefined
          ? ""
          : (chosen?.imageUrl ?? initial?.imageUrl ?? ""),
    };
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      const errors = productFieldErrors(parsed.error, reference, unit);
      setFieldErrors(errors);
      setError(
        Object.keys(errors).length
          ? "Corrige os campos assinalados antes de guardar."
          : "Não foi possível validar este produto. Revê a origem e os dados sugeridos.",
      );
      const first = Object.keys(errors)[0];
      if (first)
        requestAnimationFrame(() => {
          const field = formRef.current?.querySelector<HTMLInputElement>(
            `[name="${first}"]`,
          );
          field?.focus();
          field?.scrollIntoView({ block: "center" });
        });
      return;
    }
    if (source !== "manual" && !confirmed) {
      setError("Confirma os valores sugeridos antes de guardar.");
      return;
    }
    run(async () => {
      const result = await saveFoodProduct({
        ...input,
        id: initial?.id,
        photo,
      });
      if (result.error) return { error: result.error };
      if ("id" in result) {
        dirtyRef.current = false;
        onSaved(result.id, parsed.data);
      }
      return undefined;
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
      ref={formRef}
      aria-busy={pending || busy}
      noValidate
      onSubmit={save}
      onChangeCapture={() => {
        dirtyRef.current = true;
      }}
      className="flex flex-col gap-4"
      aria-label="Produto alimentar"
    >
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
        <h2
          tabIndex={-1}
          className="text-lg font-semibold focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          {initial?.id ? "Editar produto" : "Adicionar produto"}
        </h2>
        <ProductPhotoSection
          preview={preview}
          blob={photoAnalysis.blob}
          busy={busy}
          analyzing={photoAnalysis.analyzing}
          pending={pending}
          photoExpanded={photoAnalysis.photoExpanded}
          mode={photoAnalysis.mode}
          provider={provider}
          onMode={photoAnalysis.setMode}
          onExpand={() => photoAnalysis.setPhotoExpanded(true)}
          onFile={(file) => void photoAnalysis.choose(file)}
          onAnalyze={() => void photoAnalysis.analyze()}
          onRemove={photoAnalysis.remove}
          onCancel={photoAnalysis.cancel}
        />
        {notice && (
          <p
            role="status"
            className="text-sm text-indigo-700 dark:text-indigo-300"
          >
            {notice}
          </p>
        )}
        <ProductCandidates
          candidates={candidates}
          onApply={applyCandidate}
          onDismiss={() => {
            setCandidates([]);
            setNotice(
              "Nenhuma correspondência usada. Confirma os valores da análise antes de guardar.",
            );
          }}
        />
        <label className="label">
          Nome do alimento
          <input
            name="name"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "food-error-name" : undefined}
            className="input"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fieldErrors.name && (
            <span
              id="food-error-name"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {fieldErrors.name}
            </span>
          )}
        </label>
        <label className="label">
          Marca / loja
          <input
            name="brand"
            aria-invalid={Boolean(fieldErrors.brand)}
            aria-describedby={
              fieldErrors.brand ? "food-error-brand" : undefined
            }
            className="input"
            maxLength={80}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Ex.: Continente, Pingo Doce, Mercadona"
            list="food-store-suggestions"
          />
          {fieldErrors.brand && (
            <span
              id="food-error-brand"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {fieldErrors.brand}
            </span>
          )}
        </label>
        <datalist id="food-store-suggestions">
          {foodStores.map(([id, label]) => (
            <option key={id} value={label} />
          ))}
        </datalist>
        <NutritionTable
          unit={unit}
          reference={reference}
          values={values}
          fieldErrors={fieldErrors}
          details={details}
          source={source}
          confirmed={confirmed}
          onApplyReference={(next, convert) => {
            setError("");
            setFieldErrors({});
            dirtyRef.current = true;
            setConfirmed(false);
            setNutritionChanged(true);
            if (convert)
              setValues(
                Object.fromEntries(
                  nutrientKeys.map((key) => [
                    key,
                    values[key].trim() === ""
                      ? ""
                      : showNutrient(
                          parseWeight(values[key]) *
                            (next.quantity / reference.quantity),
                        ),
                  ]),
                ),
              );
            // A unit swap invalidates weights measured in the previous unit.
            if (next.unit !== unit)
              setDetails({
                ...details,
                packageQuantity: null,
                pieceQuantity: null,
                packageEstimated: false,
                pieceEstimated: false,
                nutritionReference: next,
              });
            else setDetails({ ...details, nutritionReference: next });
            setUnit(next.unit);
            setReference(next);
          }}
          onValue={(key, value) => {
            setValues({ ...values, [key]: value });
            setNutritionChanged(true);
            setConfirmed(false);
          }}
          onConfirm={setConfirmed}
        />
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
          <button
            type="button"
            className="btn-ghost"
            disabled={pending || busy}
            onClick={() => {
              if (
                !dirtyRef.current ||
                window.confirm("Descartar as alterações deste produto?")
              ) {
                dirtyRef.current = false;
                onCancel();
              }
            }}
          >
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
