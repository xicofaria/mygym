import assert from "node:assert/strict";
import test from "node:test";
import {
  rankFoodCandidates,
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

test("ranking filters unrelated rows and works without brand", () => {
  assert.deepEqual(
    rankFoodCandidates(
      { name: "Iogurte de morango", brand: "Marca X" },
      [candidate("Pilha de aço inoxidável", "Ferragens", 100, "1111111111111")],
    ),
    [],
  );
  const withoutBrand = rankFoodCandidates(
    { name: "Brazil Nuts", brand: "" },
    [
      candidate("Brazil Nuts", "Alesto, Lidl", 697, "20202392"),
      candidate("Barras de frutos secos", "Alesto", 388, "4056489822790"),
    ],
  );
  assert.equal(withoutBrand[0].name, "Brazil Nuts");
});
