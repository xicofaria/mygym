import { z } from "zod";
import {
  emptyProductDetails,
  foodStores,
  productSchema,
  type FoodProduct,
} from "./nutrition";

const fields =
  "code,product_name,product_name_pt,brands,nutriments,image_front_small_url,product_quantity,product_quantity_unit,nutrition_data_per";
export type FoodCandidate = Omit<FoodProduct, "id" | "hasPhoto">;

export function parseOpenFoodProduct(
  value: unknown,
): FoodCandidate | null {
  const parsed = z
    .object({
      code: z.string().regex(/^\d{8,14}$/),
      product_name: z.string().optional(),
      product_name_pt: z.string().optional(),
      brands: z.string().optional(),
      nutriments: z.record(z.string(), z.unknown()),
      image_front_small_url: z.string().optional(),
      product_quantity_unit: z.string().optional(),
      product_quantity: z.number().optional(),
      nutrition_data_per: z.string().optional(),
    })
    .safeParse(value);
  if (!parsed.success) return null;
  const p = parsed.data;
  const number = (key: string) =>
    typeof p.nutriments[key] === "number" && Number.isFinite(p.nutriments[key])
      ? (p.nutriments[key] as number)
      : null;
  const kcal =
    number("energy-kcal_100g") ??
    (number("energy-kj_100g") !== null
      ? number("energy-kj_100g")! / 4.184
      : null);
  if (kcal === null) return null;
  const unit =
    p.product_quantity_unit === "ml" || p.nutrition_data_per === "100ml"
      ? "ml"
      : "g";
  const result = productSchema.safeParse({
    name: (p.product_name_pt || p.product_name || "").slice(0, 120),
    brand: (p.brands ?? "").slice(0, 80),
    unit,
    nutrients: {
      kcal,
      protein: number("proteins_100g"),
      carbs: number("carbohydrates_100g"),
      fat: number("fat_100g"),
      saturated: number("saturated-fat_100g"),
      sugars: number("sugars_100g"),
      fiber: number("fiber_100g"),
      salt: number("salt_100g"),
    },
    source: "openfoodfacts",
    details: {
      ...emptyProductDetails,
      packageQuantity:
        p.product_quantity_unit === unit &&
        p.product_quantity &&
        p.product_quantity > 0 &&
        p.product_quantity <= 10000
          ? p.product_quantity
          : null,
    },
    sourceUrl: `https://world.openfoodfacts.org/product/${p.code}`,
    imageUrl: p.image_front_small_url?.startsWith(
      "https://images.openfoodfacts.org/",
    )
      ? p.image_front_small_url
      : "",
  });
  return result.success ? result.data : null;
}
export async function lookupFood({
  barcode,
  store,
  fetcher = fetch,
}: {
  barcode?: string;
  store?: string;
  fetcher?: typeof fetch;
}) {
  let url: URL;
  if (barcode && /^\d{8,14}$/.test(barcode))
    url = new URL(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    );
  else if (foodStores.some(([id]) => id === store)) {
    url = new URL("https://world.openfoodfacts.org/api/v2/search");
    url.searchParams.set("stores_tags", store!);
    url.searchParams.set("countries_tags", "portugal");
    url.searchParams.set("page_size", "12");
  } else
    throw new Error("Indica um código de barras válido ou escolhe uma loja.");
  url.searchParams.set("fields", fields);
  const response = await fetcher(url, {
    headers: { "User-Agent": "MyGym/1.0 (https://github.com/xicofaria/mygym)" },
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  if (response.status === 404) return [];
  if (!response.ok)
    throw new Error(
      "O catálogo externo está indisponível. Podes adicionar manualmente.",
    );
  const body = await response.json();
  const list = barcode
    ? body.product
      ? [body.product]
      : []
    : Array.isArray(body.products)
      ? body.products.slice(0, 12)
      : [];
  return list
    .map(parseOpenFoodProduct)
    .filter((p: FoodCandidate | null): p is FoodCandidate => p !== null);
}

export async function searchFoodByText({
  term,
  fetcher = fetch,
  attempts = 2,
  timeoutMs = 10000,
  delayMs = 2000,
}: {
  term: string;
  fetcher?: typeof fetch;
  attempts?: number;
  timeoutMs?: number;
  delayMs?: number;
}): Promise<FoodCandidate[]> {
  const value = term.trim().slice(0, 120);
  if (!value) return [];
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", value);
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("fields", fields);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetcher(url, {
        headers: { "User-Agent": "MyGym/1.0 (https://github.com/xicofaria/mygym)" },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
      if (response.ok) {
        const body = await response.json();
        const list = Array.isArray(body?.products) ? body.products : [];
        return list
          .map(parseOpenFoodProduct)
          .filter((p: FoodCandidate | null): p is FoodCandidate => p !== null);
      }
    } catch {
      // O catálogo externo é contexto opcional: indisponibilidade nunca falha a análise.
    }
    if (attempt < attempts - 1 && delayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return [];
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();

function editDistance(a: string, b: string) {
  const left = [...a];
  const right = [...b];
  const row = Array.from({ length: right.length + 1 }, (_, j) => j);
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const keep = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      previous = keep;
    }
  }
  return row[right.length];
}

function tokenSimilarity(a: string, b: string) {
  const left = normalizeText(a)
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const right = normalizeText(b)
    .split(/\s+/)
    .filter((token) => token.length > 2);
  if (!left.length || !right.length) return 0;
  let total = 0;
  for (const token of left)
    total += Math.max(
      0,
      ...right.map(
        (other) => 1 - editDistance(token, other) / Math.max(token.length, other.length),
      ),
    );
  return total / left.length;
}

export function rankFoodCandidates(
  identification: { name: string; brand: string },
  products: FoodCandidate[],
  limit = 3,
): FoodCandidate[] {
  const seen = new Set<string>();
  const deduped: FoodCandidate[] = [];
  for (const product of products) {
    const key = `${normalizeText(product.name)}|${Math.round(product.nutrients.kcal)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(product);
  }
  const identificationBrand = identification.brand || identification.name;
  return deduped
    .map((product) => ({
      product,
      score:
        0.65 * tokenSimilarity(identification.name, product.name) +
        0.35 *
          tokenSimilarity(
            identificationBrand,
            product.brand || identification.name,
          ),
    }))
    .filter(({ score }) => score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product);
}
