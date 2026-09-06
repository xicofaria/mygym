import assert from "node:assert/strict";
import test from "node:test";
import {
  dayResult,
  emptyNutrients,
  emptyProductDetails,
  foodStores,
  portionQuantity,
  applyDiaryPortion,
  entryInputSchema,
  goalForDate,
  nutritionTotal,
  periodDates,
  productSchema,
  scaleNutrition,
  type FoodEntry,
} from "../../src/lib/nutrition";
import {
  parseOpenFoodProduct,
  lookupFood,
} from "../../src/lib/open-food-facts";

const snapshot = productSchema.parse({
  name: "Iogurte",
  brand: "Teste",
  unit: "g",
  nutrients: { ...emptyNutrients, kcal: 80, protein: 10, carbs: 5, fat: 2 },
  source: "manual",
  sourceUrl: "",
  imageUrl: "",
});
test("diary computes canonical grams from units and preserves nutritional history", () => {
  const result = applyDiaryPortion(snapshot, 999, {
    mode: "pieces",
    amount: 20,
    unitQuantity: 1.2,
    estimated: true,
  });
  assert.equal(result.quantity, 24);
  assert.deepEqual(result.snapshot.nutrients, snapshot.nutrients);
  assert.equal(result.snapshot.details.pieceEstimated, true);
  assert.equal(snapshot.details.pieceQuantity, null);
  assert.equal(
    applyDiaryPortion(snapshot, 1, {
      mode: "package",
      amount: 0.5,
      unitQuantity: 200,
      estimated: false,
    }).quantity,
    100,
  );
  assert.throws(() =>
    applyDiaryPortion(snapshot, 1, {
      mode: "pieces",
      amount: 10000,
      unitQuantity: 200,
      estimated: true,
    }),
  );
  assert.equal(
    entryInputSchema.safeParse({
      productId: 1,
      date: "2026-09-06",
      meal: "Lanches",
      quantity: 10,
      portion: { mode: "pieces", amount: 0, unitQuantity: 1, estimated: true },
    }).success,
    false,
  );
});
test("portions convert counted units and fractional packs without changing the 100g base", () => {
  const details = {
    ...emptyProductDetails,
    packageQuantity: 200,
    pieceQuantity: 1.2,
    pieceEstimated: true,
  };
  assert.equal(portionQuantity(20, "pieces", details), 24);
  assert.equal(portionQuantity(0.5, "package", details), 100);
  assert.equal(portionQuantity(125.5, "weight", details), 125.5);
  assert.ok(Number.isNaN(portionQuantity(1, "pieces", emptyProductDetails)));
  for (const amount of [0, -1, Infinity, NaN, 10001])
    assert.ok(Number.isNaN(portionQuantity(amount, "weight", details)));
  assert.equal(
    productSchema.parse({ ...snapshot, details: undefined }).details
      .packageQuantity,
    null,
  );
  assert.equal(
    productSchema.safeParse({
      ...snapshot,
      details: { ...details, pieceQuantity: 0 },
    }).success,
    false,
  );
});
test("all five stores use fixed OFF store filters", async () => {
  for (const [store] of foodStores) {
    await lookupFood({
      store,
      fetcher: async (input) => {
        const url = new URL(String(input));
        assert.equal(url.hostname, "world.openfoodfacts.org");
        assert.equal(url.searchParams.get("stores_tags"), store);
        assert.equal(url.searchParams.get("countries_tags"), "portugal");
        return Response.json({ products: [] });
      },
    });
  }
  await assert.rejects(lookupFood({ store: "https://evil.test" }));
});
test("scales decimal portions without premature rounding; missing nutrients stay unknown", () => {
  assert.equal(scaleNutrition(snapshot.nutrients, 125.5).kcal, 100.4);
  const entries: FoodEntry[] = [
    {
      id: 1,
      productId: 1,
      date: "2026-09-05",
      meal: "Lanches",
      quantity: 125.5,
      snapshot,
    },
  ];
  const result = nutritionTotal(entries);
  assert.equal(result.totals.kcal, 100.4);
  assert.equal(result.totals.protein, 12.55);
  assert.ok(result.incomplete.includes("fiber"));
  assert.equal(scaleNutrition(snapshot.nutrients, 125.5).fiber, null);
});
test("goal history and completion do not reward missing or incomplete days", () => {
  const old = { effectiveFrom: "2026-09-01", kcal: 2100, tolerance: 10 };
  const next = { effectiveFrom: "2026-09-05", kcal: 2400, tolerance: 5 };
  assert.equal(goalForDate([next, old], "2026-09-04"), old);
  assert.equal(goalForDate([next, old], "2026-08-31"), null);
  assert.equal(dayResult(0, old, false, false), "Sem registos");
  assert.equal(dayResult(2000, old, false, true), "Por completar");
  assert.equal(dayResult(1890, old, true, true), "Dentro da meta");
  assert.equal(dayResult(1800, old, true, true), "Abaixo do intervalo");
  assert.equal(dayResult(2400, old, true, true), "Acima do intervalo");
  assert.equal(dayResult(2100, null, true, true), "Sem meta");
});
test("periods use Monday weeks and calendar months including leap years", () => {
  assert.deepEqual(periodDates("2026-01-01", "week"), [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ]);
  assert.equal(periodDates("2024-02-10", "month").length, 29);
  assert.equal(periodDates("2026-02-10", "month").length, 28);
});
test("validates nutrition and rejects untrusted external photo/source hosts", () => {
  assert.equal(
    productSchema.safeParse({
      ...snapshot,
      nutrients: { ...snapshot.nutrients, kcal: NaN },
    }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({
      ...snapshot,
      imageUrl: "https://images.openfoodfacts.org.evil.test/a",
    }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...snapshot, sourceUrl: "javascript:alert(1)" })
      .success,
    false,
  );
});
test("Open Food Facts maps per-100 data, kJ, missing fields, source and photo attribution", async () => {
  const raw = {
    code: "5601234567890",
    product_name: "Bebida",
    brands: "Continente",
    product_quantity_unit: "ml",
    nutriments: { "energy-kj_100g": 418.4, proteins_100g: 0 },
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/test.jpg",
  };
  const result = parseOpenFoodProduct(raw)!;
  assert.ok(Math.abs(result.nutrients.kcal - 100) < 0.00001);
  assert.equal(result.unit, "ml");
  assert.equal(result.nutrients.protein, 0);
  assert.equal(result.nutrients.fat, null);
  assert.equal(
    result.sourceUrl,
    "https://world.openfoodfacts.org/product/5601234567890",
  );
  assert.equal(parseOpenFoodProduct({ ...raw, nutriments: {} }), null);
  const rows = await lookupFood({
    barcode: raw.code,
    fetcher: async (url, options) => {
      assert.equal(new URL(String(url)).hostname, "world.openfoodfacts.org");
      assert.ok(
        new Headers(options?.headers).get("user-agent")?.includes("MyGym"),
      );
      return Response.json({ product: raw });
    },
  });
  assert.equal(rows.length, 1);
  await assert.rejects(lookupFood({ barcode: "https://evil.test" }));
});
