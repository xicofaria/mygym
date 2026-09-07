import assert from "node:assert/strict";
import test from "node:test";
import {
  rankFoodCandidates,
  resolveFoodCandidates,
  searchFoodByText,
  type FoodCandidate,
} from "../../src/lib/open-food-facts";
import { emptyProductDetails } from "../../src/lib/nutrition";

const candidate = (
  name: string,
  brand: string,
  kcal: number,
  code = "5601234567890",
): FoodCandidate => ({
  name,
  brand,
  unit: "g",
  nutrients: {
    kcal,
    protein: null,
    carbs: null,
    fat: null,
    saturated: null,
    sugars: null,
    fiber: null,
    salt: null,
  },
  details: emptyProductDetails,
  source: "openfoodfacts",
  sourceUrl: `https://world.openfoodfacts.org/product/${code}`,
  imageUrl: "",
});

test("text search queries the fixed OFF host, validates rows and drops invalid ones", async () => {
  let calls = 0;
  const rows = await searchFoodByText({
    term: "alesto amêndoas",
    fetcher: async (url, options) => {
      calls++;
      const parsed = new URL(String(url));
      assert.equal(parsed.hostname, "world.openfoodfacts.org");
      assert.equal(parsed.pathname, "/cgi/search.pl");
      assert.equal(parsed.searchParams.get("search_terms"), "alesto amêndoas");
      assert.equal(parsed.searchParams.get("json"), "1");
      assert.ok(
        new Headers(options?.headers).get("user-agent")?.includes("MyGym"),
      );
      return Response.json({
        products: [
          {
            code: "20724696",
            product_name: "Amêndoas natural",
            brands: "Alesto",
            nutriments: { "energy-kcal_100g": 621 },
          },
          { code: "20724697", product_name: "Sem kcal", nutriments: {} },
          { code: "não-é-código", product_name: "X", nutriments: { "energy-kcal_100g": 1 } },
        ],
      });
    },
  });
  assert.equal(calls, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Amêndoas natural");
  assert.equal(rows[0].source, "openfoodfacts");
  assert.match(rows[0].sourceUrl, /product\/20724696$/);
});

test("text search retries transient failures once and then returns empty instead of throwing", async () => {
  let failures = 0;
  const none = await searchFoodByText({
    term: "qualquer",
    attempts: 3,
    delayMs: 0,
    fetcher: async () => {
      failures++;
      return new Response("Service Unavailable", { status: 503 });
    },
  });
  assert.equal(failures, 3);
  assert.deepEqual(none, []);
  let aborted = 0;
  const started = Date.now();
  assert.deepEqual(
    await searchFoodByText({
      term: "qualquer",
      attempts: 2,
      delayMs: 0,
      timeoutMs: 50,
      fetcher: (_url, options) =>
        new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () => {
            aborted++;
            reject(new Error("AbortError"));
          });
        }),
    }),
    [],
  );
  assert.equal(aborted, 2);
  assert.ok(Date.now() - started < 5_000);
  let crashes = 0;
  assert.deepEqual(
    await searchFoodByText({
      term: "qualquer",
      attempts: 2,
      delayMs: 0,
      fetcher: async () => {
        crashes++;
        throw new Error("rede em baixo");
      },
    }),
    [],
  );
  assert.equal(crashes, 2);
  assert.deepEqual(
    await searchFoodByText({
      term: "qualquer",
      delayMs: 0,
      fetcher: async () => new Response("<html>503</html>"),
    }),
    [],
  );
  assert.deepEqual(
    await searchFoodByText({
      term: "   ",
      fetcher: async () => {
        throw new Error("não deve ser chamado");
      },
    }),
    [],
  );
  let recovered = 0;
  const back = await searchFoodByText({
    term: "qualquer",
    attempts: 2,
    delayMs: 0,
    fetcher: async () => {
      recovered++;
      if (recovered === 1) return new Response("503", { status: 503 });
      return Response.json({
        products: [
          {
            code: "20005733",
            product_name: "Nozes",
            brands: "Alesto",
            nutriments: { "energy-kj_100g": 2978.9 },
          },
        ],
      });
    },
  });
  assert.equal(recovered, 2);
  assert.equal(back.length, 1);
  assert.ok(Math.abs(back[0].nutrients.kcal - 711.9742) < 0.001);
});

test("ranking tolerates typos and other languages and caps at three", () => {
  const products = [
    candidate("Amêndoas natural", "Alesto, LIDL", 621, "20724696"),
    candidate("Pistaches", "Alesto", 614, "4335619014442"),
    candidate("Cranberries", "Alesto", 330, "20150907"),
    candidate("Almendras de California", "Alesto", 621, "06104696"),
    candidate("Nozes", "Alesto", 712, "20005733"),
  ];
  const ranked = rankFoodCandidates(
    { name: "Amêndoas de California", brand: "Alesto" },
    products,
  );
  assert.equal(ranked.length, 3);
  assert.match(ranked[0].name, /Amêndoas|Almendras/);
  assert.ok(ranked.every((p) => p.sourceUrl));
});

test("deduplication is by product code; package sizes of the same name survive", () => {
  const small = {
    ...candidate("Amêndoas natural", "Alesto", 621, "20724696"),
    details: { ...emptyProductDetails, packageQuantity: 200 },
  };
  const clone = candidate("Amêndoas natural", "Alesto", 621, "20724696");
  const large = {
    ...candidate("Amêndoas natural", "Alesto", 621, "20724697"),
    details: { ...emptyProductDetails, packageQuantity: 300 },
  };
  const ranked = rankFoodCandidates(
    { name: "Amêndoas", brand: "Alesto" },
    [small, clone, large],
  );
  assert.deepEqual(
    ranked.map((p) => p.details.packageQuantity),
    [200, 300],
  );
});

test("ranking filters unrelated rows", () => {
  assert.deepEqual(
    rankFoodCandidates(
      { name: "Iogurte de morango", brand: "Marca X" },
      [candidate("Pilha de aço inoxidável", "Ferragens", 100, "1111111111111")],
    ),
    [],
  );
});

test("without brand, ranking falls back to the identified name", () => {
  const withoutBrand = rankFoodCandidates(
    { name: "Brazil Nuts", brand: "" },
    [
      candidate("Brazil Nuts", "Alesto, Lidl", 697, "20202392"),
      candidate("Barras de frutos secos", "Alesto", 388, "4056489822790"),
    ],
  );
  assert.equal(withoutBrand[0].name, "Brazil Nuts");
});

const offRow = {
  code: "20724696",
  product_name: "Amêndoas natural",
  brands: "Alesto",
  nutriments: { "energy-kcal_100g": 621 },
};

test("candidate resolution skips the catalogue when the budget is already spent", async () => {
  let calls = 0;
  const none = await resolveFoodCandidates({
    identification: { barcode: "5601234567890", name: "Amêndoas", brand: "Alesto" },
    startedAt: Date.now() - 200_000,
    budgetMs: 125_000,
    fetcher: async () => {
      calls++;
      throw new Error("não deve ser chamado");
    },
  });
  assert.deepEqual(none, []);
  assert.equal(calls, 0);
});

test("a slow barcode lookup consumes the remaining budget and skips the text search", async () => {
  let calls = 0;
  const none = await resolveFoodCandidates({
    identification: { barcode: "5601234567890", name: "Amêndoas", brand: "Alesto" },
    startedAt: Date.now(),
    budgetMs: 7_000,
    fetcher: async (url, options) => {
      calls++;
      assert.match(String(url), /api\/v2\/product\//);
      assert.ok(options?.signal instanceof AbortSignal);
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      return new Response("Not Found", { status: 404 });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(none, []);
});

test("a failed exact lookup falls through to the text search inside the budget", async () => {
  const calls: string[] = [];
  const found = await resolveFoodCandidates({
    identification: { barcode: "5601234567890", name: "Amêndoas", brand: "Alesto" },
    startedAt: Date.now(),
    budgetMs: 7_000,
    fetcher: async (url) => {
      const target = String(url);
      calls.push(target);
      if (target.includes("/api/v2/product/"))
        return new Response("Not Found", { status: 404 });
      return Response.json({ products: [offRow] });
    },
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /cgi\/search\.pl/);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, "Amêndoas natural");
});

test("a successful exact barcode lookup never triggers the text search", async () => {
  let calls = 0;
  const found = await resolveFoodCandidates({
    identification: { barcode: "20724696", name: "Amêndoas", brand: "Alesto" },
    startedAt: Date.now(),
    budgetMs: 125_000,
    fetcher: async () => {
      calls++;
      return Response.json({ product: offRow });
    },
  });
  assert.equal(calls, 1);
  assert.equal(found.length, 1);
  assert.equal(found[0].details.packageQuantity, null);
});
