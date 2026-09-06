import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { foodProducts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAIConfig } from "@/lib/ai-config";
import { reserveAIQuota } from "@/lib/ai-quota";
import { lisbonDateKey } from "@/lib/format";
import { hasSameOrigin } from "@/lib/request-origin";
import { recognizeFood } from "@/lib/food-recognition";
import { emptyProductDetails, productSchema } from "@/lib/nutrition";
import { LoginRateLimiter } from "@/lib/login-rate-limit-core";

export const runtime = "nodejs";
export const maxDuration = 150;
const limiter = new LoginRateLimiter({ maxAttempts: 10, windowMs: 60000 });
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Inicia sessão." }, 401);
  if (!hasSameOrigin(request)) return json({ error: "Pedido inválido." }, 403);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    return json({ error: "Produto não encontrado." }, 404);
  try {
    const row = await db
      .select({
        name: foodProducts.name,
        brand: foodProducts.brand,
        unit: foodProducts.unit,
        nutrients: foodProducts.nutrients,
        details: foodProducts.details,
        source: foodProducts.source,
        sourceUrl: foodProducts.sourceUrl,
        imageUrl: foodProducts.imageUrl,
      })
      .from(foodProducts)
      .where(
        and(
          eq(foodProducts.id, id),
          eq(foodProducts.userId, user.id),
          eq(foodProducts.archived, false),
        ),
      )
      .get();
    if (!row) return json({ error: "Produto não encontrado." }, 404);
    const product = productSchema.parse({
      ...row,
      nutrients: JSON.parse(row.nutrients),
      details: { ...emptyProductDetails, ...JSON.parse(row.details) },
    });
    if (product.details.pieceQuantity)
      return json({
        quantity: product.details.pieceQuantity,
        unit: product.unit,
        estimated: product.details.pieceEstimated,
        explanation: "Peso já disponível no teu catálogo.",
      });
    const config = getAIConfig();
    if (!config.apiKey)
      return json(
        { error: "IA não configurada. Podes indicar o peso aqui no diário." },
        503,
      );
    if (!limiter.consume(String(user.id)).allowed)
      return json({ error: "Aguarda um minuto." }, 429);
    if (
      !(await reserveAIQuota(db, user.id, lisbonDateKey(), config.dailyLimit))
    )
      return json({ error: "Limite diário de IA atingido." }, 429);
    const result = await recognizeFood({
      ...config,
      mode: "estimate",
      signal: request.signal,
      productContext: {
        name: product.name,
        brand: product.brand,
        unit: product.unit,
        nutrients: product.nutrients,
      },
    });
    const quantity =
      result.product?.unit === product.unit
        ? result.product.details.pieceQuantity
        : null;
    return json({
      quantity,
      unit: product.unit,
      estimated: true,
      explanation: quantity
        ? "Peso médio estimado pela IA. Confirma a unidade; pesar é mais preciso."
        : "Não foi possível estimar uma unidade. Indica o peso ou regista em gramas/ml.",
    });
  } catch {
    return json(
      {
        error:
          "Não foi possível estimar. Podes indicar o peso manualmente neste diário.",
      },
      502,
    );
  }
}
