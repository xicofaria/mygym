"use client";
/* eslint-disable @next/next/no-img-element -- private endpoints and attributed product photos */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { getCalorieData } from "@/lib/calorie-queries";
import {
  archiveFoodProduct,
  deleteFoodEntry,
  saveCalorieGoal,
  saveFoodEntry,
  setFoodDayComplete,
} from "@/app/(app)/calories/actions";
import {
  dayResult,
  foodStores,
  goalForDate,
  meals,
  nutrientLabels,
  nutrientKeys,
  nutritionTotal,
  periodDates,
  productSchema,
  portionQuantity,
  scaleNutrition,
  type FoodEntry,
  type FoodProduct,
} from "@/lib/nutrition";
import { parseWeight } from "@/lib/decimal";
import { FoodProductForm } from "./food-product-form";
import { DiaryPortion } from "./diary-portion";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(n);
export function CaloriesTracker({
  data,
  date,
  today,
  period,
  provider,
}: {
  data: Awaited<ReturnType<typeof getCalorieData>>;
  date: string;
  today: string;
  period: "day" | "week" | "month";
  provider: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("diary");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [editor, setEditor] = useState<Partial<FoodProduct> | null>(null);
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [external, setExternal] = useState<Partial<FoodProduct>[]>([]);
  const [searching, setSearching] = useState(false);
  const [externalNotice, setExternalNotice] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quantityMode, setQuantityMode] = useState<
    "weight" | "package" | "pieces"
  >("weight");
  const [meal, setMeal] = useState<string>(meals[0]);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [portionOverride, setPortionOverride] = useState<{
    key: string;
    unitQuantity: number;
    estimated: boolean;
  } | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [tolerance, setTolerance] = useState("10");
  const entries = data.entries.filter((e) => e.date === date);
  const goal = goalForDate(data.goals, date);
  const currentGoal = goalForDate(data.goals, today);
  const { totals, incomplete } = nutritionTotal(entries);
  const complete = data.days.some((d) => d.date === date && d.completed);
  const chosen =
    editing?.productId === Number(productId)
      ? editing.snapshot
      : data.products.find((p) => p.id === Number(productId));
  const portionKey = `${productId}:${editing?.id ?? "new"}:${quantityMode}`;
  const details = chosen
    ? {
        ...chosen.details,
        ...(portionOverride?.key === portionKey
          ? quantityMode === "pieces"
            ? {
                pieceQuantity: portionOverride.unitQuantity,
                pieceEstimated: portionOverride.estimated,
              }
            : {
                packageQuantity: portionOverride.unitQuantity,
                packageEstimated: portionOverride.estimated,
              }
          : {}),
      }
    : null;
  const amount = details
    ? portionQuantity(parseWeight(quantity), quantityMode, details)
    : NaN;
  const preview =
    chosen && Number.isFinite(amount) && amount > 0
      ? scaleNutrition(chosen.nutrients, amount)
      : null;
  const dates = periodDates(date, period).filter((d) => d <= today);
  const summary = dates.map((day) => {
    const rows = data.entries.filter((e) => e.date === day);
    const kcal = nutritionTotal(rows).totals.kcal;
    const target = goalForDate(data.goals, day);
    const closed = data.days.some((d) => d.date === day && d.completed);
    return {
      day,
      kcal,
      target,
      closed,
      hasEntries: rows.length > 0,
      result: dayResult(kcal, target, closed, rows.length > 0),
    };
  });
  const within = summary.filter((d) => d.result === "Dentro da meta").length;
  const closed = summary.filter((d) => d.closed && d.hasEntries).length;
  const recorded = summary.filter((d) => d.hasEntries).length;
  const totalKcal = summary.reduce((sum, d) => sum + d.kcal, 0);
  function navigate(nextDate: string, nextPeriod = period) {
    router.push(`/calories?date=${nextDate}&period=${nextPeriod}`);
  }
  function run(
    action: () => Promise<{ error: string | null }>,
    after?: () => void,
  ) {
    setError("");
    start(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else {
          after?.();
          router.refresh();
        }
      } catch {
        setError(
          "Não foi possível guardar. Tenta novamente; os campos foram mantidos.",
        );
      }
    });
  }
  async function lookup(store?: string) {
    setSearching(true);
    setError("");
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
      setError(e instanceof Error ? e.message : "Pesquisa indisponível.");
    } finally {
      setSearching(false);
    }
  }
  const resetEntry = () => {
    setPortionOverride(null);
    setQuantityMode("weight");
    setEditing(null);
    setQuantity("");
    setProductId("");
  };
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Calorias</h1>
        <p className="text-sm text-zinc-500">
          O teu diário alimentar. As tuas metas.
        </p>
      </header>
      <div className="flex gap-1 border-b border-black/10 dark:border-white/10">
        {[
          ["diary", "Diário"],
          ["products", "Produtos"],
          ["overview", "Evolução"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            className={`min-h-11 flex-1 border-b-2 text-sm font-medium transition-colors ${tab === value ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-zinc-500"}`}
            onClick={() => {
              setTab(value);
              setEditor(null);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {tab !== "products" && (
        <label className="label">
          Data do diário
          <input
            type="date"
            className="input"
            max={today}
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                resetEntry();
                navigate(e.target.value);
              }
            }}
          />
        </label>
      )}
      {tab === "diary" && (
        <>
          <section
            aria-label="Resumo do dia"
            className="border-b border-black/10 pb-5 dark:border-white/10"
          >
            <p className="text-sm text-zinc-500">
              {date === today ? "Hoje" : date} ·{" "}
              {dayResult(totals.kcal, goal, complete, entries.length > 0)}
            </p>
            <p className="my-2">
              <span className="text-5xl font-semibold tracking-tight tabular-nums">
                {fmt(totals.kcal)}
              </span>{" "}
              <span className="text-zinc-500">
                kcal {goal ? "/ " + fmt(goal.kcal) : ""}
              </span>
            </p>
            {goal ? (
              <>
                <progress
                  aria-label="Progresso calórico do dia"
                  className="nutrition-progress h-2 w-full"
                  max={goal.kcal}
                  value={Math.min(totals.kcal, goal.kcal)}
                />
                <p className="mt-2 text-xs text-zinc-500">
                  {totals.kcal <= goal.kcal
                    ? `${fmt(goal.kcal - totals.kcal)} kcal até à meta`
                    : `${fmt(totals.kcal - goal.kcal)} kcal acima da meta`}{" "}
                  · intervalo ±{goal.tolerance}%
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                Define uma meta em baixo. Não propomos uma ingestão
                personalizada.
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(["protein", "carbs", "fat"] as const).map((key) => (
                <div key={key}>
                  <p className="text-xs text-zinc-500">{nutrientLabels[key]}</p>
                  <p className="font-semibold">
                    {fmt(totals[key])} g{incomplete.includes(key) ? "*" : ""}
                  </p>
                </div>
              ))}
            </div>
            {incomplete.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                * Total parcial: há alimentos com nutrientes desconhecidos.
              </p>
            )}
          </section>
          <form
            aria-label="Adicionar ao diário"
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  saveFoodEntry({
                    id: editing?.id,
                    productId: Number(productId),
                    quantity: amount,
                    portion:
                      quantityMode === "weight"
                        ? undefined
                        : {
                            mode: quantityMode,
                            amount: parseWeight(quantity),
                            unitQuantity:
                              quantityMode === "pieces"
                                ? details?.pieceQuantity
                                : details?.packageQuantity,
                            estimated:
                              quantityMode === "pieces"
                                ? details?.pieceEstimated
                                : details?.packageEstimated,
                          },
                    meal,
                    date,
                  }),
                resetEntry,
              );
            }}
          >
            <h2 className="font-semibold">
              {editing ? "Editar consumo" : "Adicionar ao diário"}
            </h2>
            <label className="label">
              Alimento
              <select
                aria-label="Alimento"
                className="input"
                required
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setPortionOverride(null);
                  setQuantityMode("weight");
                  setQuantity("");
                }}
              >
                <option value="">Escolher produto</option>
                {editing?.productId &&
                  !data.products.some((p) => p.id === editing.productId) && (
                    <option value={editing.productId}>
                      {editing.snapshot.name} (arquivado)
                    </option>
                  )}
                {data.products.map((p) => (
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
                  onChange={(e) => {
                    setQuantityMode(e.target.value as typeof quantityMode);
                    setPortionOverride(null);
                    setQuantity("");
                  }}
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
                  onChange={(e) => setQuantity(e.target.value)}
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
                  onChange={(e) => setMeal(e.target.value)}
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
                    onClick={() => setQuantity(value)}
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
                  setPortionOverride({ key: portionKey, ...value })
                }
              />
            )}
            {preview && (
              <p
                role="status"
                className="text-sm text-indigo-700 dark:text-indigo-300"
              >
                {fmt(preview.kcal)} kcal para{" "}
                {quantityMode === "weight" ? quantity : fmt(amount)}{" "}
                {chosen!.unit}
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
              {editing ? "Guardar consumo" : "Registar consumo"}
            </button>
            {editing && (
              <button type="button" className="btn-ghost" onClick={resetEntry}>
                Cancelar edição
              </button>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setTab("products");
                setEditor({});
              }}
            >
              + Criar produto / fotografia
            </button>
          </form>
          <section
            aria-label="Refeições do dia"
            className="flex flex-col gap-4"
          >
            {!entries.length && (
              <p className="py-4 text-sm text-zinc-500">
                Ainda não registaste alimentos neste dia.
              </p>
            )}
            {meals.map((m) => {
              const rows = entries.filter((e) => e.meal === m);
              if (!rows.length) return null;
              return (
                <div key={m}>
                  <h2 className="mb-2 flex justify-between font-semibold">
                    {m}
                    <span>{fmt(nutritionTotal(rows).totals.kcal)} kcal</span>
                  </h2>
                  {rows.map((entry) => (
                    <article
                      aria-label={entry.snapshot.name}
                      key={entry.id}
                      className="border-t border-black/5 py-3 dark:border-white/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{entry.snapshot.name}</p>
                          <p className="text-xs text-zinc-500">
                            {fmt(entry.quantity)} {entry.snapshot.unit} ·{" "}
                            {entry.snapshot.brand}{" "}
                            {entry.snapshot.source === "estimate-ai"
                              ? "· Estimativa IA"
                              : ""}
                          </p>
                          {entry.snapshot.details.pieceQuantity && (
                            <p className="text-xs text-zinc-500">
                              ≈{" "}
                              {fmt(
                                entry.quantity /
                                  entry.snapshot.details.pieceQuantity,
                              )}{" "}
                              unidades
                              {entry.snapshot.details.pieceEstimated
                                ? " (peso médio estimado)"
                                : ""}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-medium">
                          {fmt(
                            scaleNutrition(
                              entry.snapshot.nutrients,
                              entry.quantity,
                            ).kcal,
                          )}{" "}
                          kcal
                        </span>
                      </div>
                      <details className="mt-2 text-xs text-zinc-500">
                        <summary className="cursor-pointer">
                          Valores nutricionais
                        </summary>
                        <p className="mt-1">
                          {Object.entries(
                            scaleNutrition(
                              entry.snapshot.nutrients,
                              entry.quantity,
                            ),
                          )
                            .map(
                              ([k, v]) =>
                                `${nutrientLabels[k as keyof typeof nutrientLabels]}: ${v === null ? "desconhecido" : fmt(v) + (k === "kcal" ? "" : " g")}`,
                            )
                            .join(" · ")}
                        </p>
                      </details>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setEditing(entry);
                            setPortionOverride(null);
                            setQuantityMode("weight");
                            setProductId(String(entry.productId));
                            setQuantity(String(entry.quantity));
                            setMeal(entry.meal);
                          }}
                        >
                          Editar consumo
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm("Eliminar este consumo?"))
                              run(() => deleteFoodEntry(entry.id));
                          }}
                        >
                          Eliminar consumo
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })}
            <button
              type="button"
              className="btn-ghost"
              disabled={pending || !entries.length}
              onClick={() => run(() => setFoodDayComplete(date, !complete))}
            >
              {complete ? "Reabrir dia" : "Concluir registo do dia"}
            </button>
            <p className="text-xs text-zinc-500">
              Conclui quando tiveres registado todas as refeições. Editar um
              consumo reabre o dia. Comer menos não é automaticamente cumprir a
              meta.
            </p>
          </section>
          <details className="border-t border-black/10 pt-4 dark:border-white/10">
            <summary className="cursor-pointer font-semibold">
              Definir meta diária
            </summary>
            <form
              className="mt-3 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  saveCalorieGoal({
                    kcal: parseWeight(goalInput),
                    tolerance: parseWeight(tolerance),
                  }),
                );
              }}
            >
              <p className="text-xs text-zinc-500">
                A alteração aplica-se a partir de hoje ({today}); dias
                anteriores mantêm as metas históricas.{" "}
                {currentGoal
                  ? `Meta atual: ${fmt(currentGoal.kcal)} kcal.`
                  : ""}
              </p>
              <label className="label">
                Meta (kcal)
                <input
                  className="input"
                  inputMode="decimal"
                  required
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="Definida por ti"
                />
              </label>
              <label className="label">
                Margem da meta (%)
                <input
                  className="input"
                  inputMode="decimal"
                  required
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                />
              </label>
              <button className="btn-primary" disabled={pending}>
                Guardar meta
              </button>
            </form>
          </details>
        </>
      )}
      {tab === "products" &&
        (editor ? (
          <FoodProductForm
            key={editor.id ?? "new"}
            initial={editor}
            provider={provider}
            onSaved={(id) => {
              setEditor(null);
              setProductId(String(id));
              setPortionOverride(null);
              setQuantityMode("weight");
              setQuantity("");
              setEditing(null);
              setTab("diary");
              router.refresh();
            }}
            onCancel={() => setEditor(null)}
          />
        ) : (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setEditor({})}
            >
              + Novo produto
            </button>
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
            <div className="divide-y divide-black/10 dark:divide-white/10">
              {data.products
                .filter((p) =>
                  (p.name + " " + p.brand)
                    .toLocaleLowerCase("pt")
                    .includes(search.toLocaleLowerCase("pt")),
                )
                .map((p) => (
                  <article
                    key={p.id}
                    aria-label={p.name}
                    className="flex gap-3 py-3"
                  >
                    {(p.hasPhoto || p.imageUrl) && (
                      <img
                        className="h-16 w-16 rounded-lg object-contain"
                        src={
                          p.hasPhoto
                            ? `/api/calories/photos/${p.id}`
                            : p.imageUrl
                        }
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
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setProductId(String(p.id));
                            setPortionOverride(null);
                            setQuantityMode("weight");
                            setEditing(null);
                            setQuantity("");
                            setTab("diary");
                          }}
                        >
                          Consumir
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => setEditor(p)}
                        >
                          Editar produto
                        </button>
                        <button
                          className="btn-ghost"
                          disabled={pending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Arquivar produto e apagar a fotografia guardada? O histórico nutricional mantém-se.",
                              )
                            )
                              run(() => archiveFoodProduct(p.id));
                          }}
                        >
                          Arquivar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
            </div>
            {!data.products.length && (
              <p className="text-sm text-zinc-500">
                Cria o primeiro produto manualmente, por fotografia ou código de
                barras.
              </p>
            )}
            <section className="border-t border-black/10 pt-4 dark:border-white/10">
              <h2 className="font-semibold">Procurar produtos reais</h2>
              <p className="my-2 text-xs text-zinc-500">
                Open Food Facts: catálogo colaborativo, não oficial das lojas.
                Dados ODbL; fotos CC BY-SA. Confirma marca, porção, unidade e
                rótulo atual.
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
                  <button className="btn-ghost" onClick={() => setEditor(p)}>
                    Rever
                  </button>
                </article>
              ))}
            </section>
          </>
        ))}
      {tab === "overview" && (
        <>
          <div className="flex gap-2">
            {(
              [
                ["day", "Dia"],
                ["week", "Semana"],
                ["month", "Mês"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={
                  period === value ? "btn-primary flex-1" : "btn-ghost flex-1"
                }
                aria-pressed={period === value}
                onClick={() => navigate(date, value)}
              >
                {label}
              </button>
            ))}
          </div>
          <section aria-label="Resumo do período">
            <p className="text-sm text-zinc-500">
              {dates[0]} — {dates.at(-1)}
            </p>
            <p className="my-3 text-4xl font-semibold">
              {within}{" "}
              <span className="text-base font-normal text-zinc-500">
                dias dentro da meta
              </span>
            </p>
            <p className="text-sm">
              {closed} dias concluídos · {recorded} com registos ·{" "}
              {dates.length - recorded} sem registos
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {fmt(totalKcal)} kcal registadas · média de{" "}
              {fmt(recorded ? totalKcal / recorded : 0)} kcal por dia com
              registos (pode ser parcial)
            </p>
            <progress
              aria-label="Dias dentro da meta"
              className="nutrition-progress mt-3 h-2 w-full"
              max={Math.max(dates.length, 1)}
              value={within}
            />
          </section>
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {summary.map((day) => (
              <button
                key={day.day}
                className="flex w-full flex-col gap-2 py-3 text-left"
                onClick={() => {
                  setTab("diary");
                  navigate(day.day);
                }}
              >
                <span className="flex justify-between gap-3 text-sm">
                  <span>
                    {day.day.slice(8)}/{day.day.slice(5, 7)} · {day.result}
                  </span>
                  <span>{fmt(day.kcal)} kcal</span>
                </span>
                <progress
                  aria-label={`Consumo em ${day.day}`}
                  className="nutrition-progress h-1.5 w-full"
                  max={day.target?.kcal ?? Math.max(day.kcal, 1)}
                  value={Math.min(day.kcal, day.target?.kcal ?? day.kcal)}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Apenas dias concluídos com meta definida podem contar como
            cumpridos. A margem é configurada por ti. Dias futuros não entram
            nos marcos.
          </p>
        </>
      )}
    </div>
  );
}
