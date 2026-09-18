"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveFoodProduct,
  deleteFoodEntry,
  saveCalorieGoal,
  saveFoodEntry,
  setFoodDayComplete,
} from "@/app/(app)/calories/actions";
import {
  goalForDate,
  nutritionTotal,
  type FoodEntry,
  type FoodProduct,
} from "@/lib/nutrition";
import { parseWeight } from "@/lib/decimal";
import { useAction } from "@/lib/use-action";
import { FoodProductForm } from "./food-product-form";
import { DaySummary } from "./calories/day-summary";
import { EntryForm } from "./calories/entry-form";
import { GoalForm } from "./calories/goal-form";
import { MealList } from "./calories/meal-list";
import { OverviewTab } from "./calories/overview-tab";
import { ProductCatalogue } from "./calories/product-catalogue";
import { RepeatRecent } from "./calories/repeat-recent";
import { deriveEntry, useEntryDraft, type CalorieData } from "./calories/entry-draft";

export function CaloriesTracker({
  data,
  date,
  today,
  period,
  provider,
  openGoal = false,
}: {
  data: CalorieData;
  date: string;
  today: string;
  period: "day" | "week" | "month";
  provider: "openai" | "openrouter";
  openGoal?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("diary");
  const { pending, error, setError, run } = useAction(
    "Não foi possível guardar. Tenta novamente; os campos foram mantidos.",
  );
  const [editor, setEditor] = useState<Partial<FoodProduct> | null>(null);
  const [editorOrigin, setEditorOrigin] = useState("products");
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  const catalogueButtonRef = useRef<HTMLButtonElement>(null);
  const barcodeFieldRef = useRef<HTMLInputElement>(null);
  const [draft, dispatch] = useEntryDraft();
  const goalDetailsRef = useRef<HTMLDetailsElement>(null);
  const goalFieldRef = useRef<HTMLInputElement>(null);
  const entryHeadingRef = useRef<HTMLHeadingElement>(null);
  const editOriginRef = useRef<HTMLButtonElement | null>(null);
  const restoreEntryFocusRef = useRef(false);
  const { editing, repeating } = draft;
  useEffect(() => {
    if ((!editing && !repeating) || tab !== "diary") return;
    entryHeadingRef.current?.focus();
    entryHeadingRef.current?.scrollIntoView({ block: "center" });
  }, [editing, repeating, tab]);
  useEffect(() => {
    if (
      pending ||
      editing ||
      repeating ||
      tab !== "diary" ||
      !restoreEntryFocusRef.current
    )
      return;
    restoreEntryFocusRef.current = false;
    editOriginRef.current?.focus();
    editOriginRef.current?.scrollIntoView({ block: "center" });
  }, [editing, repeating, pending, tab]);
  const entries = data.entries.filter((e) => e.date === date);
  const goal = goalForDate(data.goals, date);
  const currentGoal = goalForDate(data.goals, today);
  const { totals, incomplete } = nutritionTotal(entries);
  const complete = data.days.some((d) => d.date === date && d.completed);
  const derived = deriveEntry(draft, data.products);
  function navigate(nextDate: string, nextPeriod = period) {
    router.push(`/calories?date=${nextDate}&period=${nextPeriod}`);
  }
  function save(
    action: () => Promise<{ error: string | null }>,
    after?: () => void,
  ) {
    run(action, () => {
      after?.();
      router.refresh();
    });
  }
  function resetEntry() {
    if (editing || repeating) restoreEntryFocusRef.current = true;
    dispatch({ type: "reset" });
  }
  function openProduct(
    product: Partial<FoodProduct>,
    origin: string,
    trigger: HTMLElement,
    manual = false,
  ) {
    if (!editor) {
      editorTriggerRef.current = trigger;
      setEditorOrigin(origin);
      setEditor(product);
    }
    setTab("products");
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        manual
          ? '[aria-label="Produto alimentar"] input[name="name"]'
          : '[aria-label="Produto alimentar"] h2',
      );
      target?.focus();
      target?.scrollIntoView({ block: "center" });
    });
  }
  function closeProduct() {
    setEditor(null);
    setTab(editorOrigin);
    requestAnimationFrame(() => {
      if (editorTriggerRef.current?.isConnected) editorTriggerRef.current.focus();
      else if (editorOrigin === "products") catalogueButtonRef.current?.focus();
      else entryHeadingRef.current?.focus();
    });
  }
  function consume(product: FoodProduct) {
    dispatch({
      type: "consume",
      productId: String(product.id),
      packaged: product.details.packageQuantity !== null,
    });
  }
  return (
    <div aria-busy={pending} className="flex flex-col gap-5">
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
          <DaySummary
            date={date}
            today={today}
            totals={totals}
            incomplete={incomplete}
            goal={goal}
            entryCount={entries.length}
            complete={complete}
            pending={pending}
            goalDetailsRef={goalDetailsRef}
            goalFieldRef={goalFieldRef}
            onToggleComplete={() =>
              save(() => setFoodDayComplete(date, !complete))
            }
          />
          <RepeatRecent
            recent={data.recent}
            pending={pending}
            guard={() =>
              !(editing || repeating || draft.quantity) ||
              window.confirm(
                "Substituir os campos do consumo atual? Nada será registado até confirmares.",
              )
            }
            onRepeat={(entry, trigger) => {
              editOriginRef.current = trigger;
              dispatch({ type: "repeat", entry });
            }}
          />
          <EntryForm
            products={data.products}
            draft={draft}
            dispatch={dispatch}
            derived={derived}
            date={date}
            provider={provider}
            pending={pending}
            entryHeadingRef={entryHeadingRef}
            onSubmit={() =>
              save(
                () =>
                  saveFoodEntry({
                    id: editing?.id,
                    repeatFromId: repeating?.id,
                    productId: Number(draft.productId),
                    quantity: derived.amount,
                    portion:
                      draft.quantityMode === "weight"
                        ? undefined
                        : {
                            mode: draft.quantityMode,
                            amount: parseWeight(draft.quantity),
                            unitQuantity:
                              draft.quantityMode === "pieces"
                                ? derived.details?.pieceQuantity
                                : derived.details?.packageQuantity,
                            estimated:
                              draft.quantityMode === "pieces"
                                ? derived.details?.pieceEstimated
                                : derived.details?.packageEstimated,
                          },
                    meal: draft.meal,
                    date,
                  }),
                resetEntry,
              )
            }
            onCancel={resetEntry}
            onCreateProduct={(trigger) => openProduct({}, "diary", trigger)}
          />
          <MealList
            entries={entries}
            pending={pending}
            onEdit={(entry: FoodEntry, trigger) => {
              editOriginRef.current = trigger;
              dispatch({ type: "edit", entry });
            }}
            onDelete={(entry) => {
              if (window.confirm("Eliminar este consumo?"))
                save(() => deleteFoodEntry(entry.id));
            }}
          />
          <GoalForm
            today={today}
            currentGoal={currentGoal}
            openGoal={openGoal}
            pending={pending}
            goalDetailsRef={goalDetailsRef}
            goalFieldRef={goalFieldRef}
            onSave={(kcal, tolerance) =>
              save(() => saveCalorieGoal({ kcal, tolerance }))
            }
          />
        </>
      )}
      {(tab === "products" || editor) && (
        <div
          hidden={tab !== "products"}
          className={tab === "products" ? "flex flex-col gap-5" : "hidden"}
        >
          {editor ? (
            <FoodProductForm
              key={editor.id ?? "new"}
              initial={editor}
              provider={provider}
              onSaved={(id, product) => {
                closeProduct();
                if (editorOrigin === "diary") {
                  dispatch({
                    type: "consume",
                    productId: String(id),
                    packaged: product.details.packageQuantity !== null,
                  });
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLInputElement>(
                        '[aria-label="Quantidade consumida"]',
                      )
                      ?.focus(),
                  );
                }
                router.refresh();
              }}
              onCancel={closeProduct}
            />
          ) : (
            <ProductCatalogue
              products={data.products}
              pending={pending}
              catalogueButtonRef={catalogueButtonRef}
              barcodeFieldRef={barcodeFieldRef}
              onOpenProduct={(product, trigger, manual) =>
                openProduct(product, "products", trigger, manual)
              }
              onBarcode={() => {
                setEditorOrigin("products");
                barcodeFieldRef.current?.focus();
                barcodeFieldRef.current?.scrollIntoView({ block: "center" });
              }}
              onConsume={(product) => {
                consume(product);
                setTab("diary");
              }}
              onArchive={(product) => {
                if (
                  window.confirm(
                    "Arquivar produto e apagar a fotografia guardada? O histórico nutricional mantém-se.",
                  )
                )
                  save(() => archiveFoodProduct(product.id));
              }}
              onError={setError}
            />
          )}
        </div>
      )}
      {tab === "overview" && (
        <OverviewTab
          data={data}
          date={date}
          today={today}
          period={period}
          onPeriod={(value) => navigate(date, value)}
          onSelectDay={(day) => {
            setTab("diary");
            navigate(day);
          }}
        />
      )}
    </div>
  );
}
