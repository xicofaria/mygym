import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { getAIConfig } from "@/lib/ai-config";
import { reserveAIQuota } from "@/lib/ai-quota";
import { lisbonDateKey } from "@/lib/format";
import { hasSameOrigin } from "@/lib/request-origin";
import { readPhoto, RecognitionError } from "@/lib/machine-recognition";
import { recognizeFood } from "@/lib/food-recognition";
import {
  lookupFood,
  rankFoodCandidates,
  searchFoodByText,
  type FoodCandidate,
} from "@/lib/open-food-facts";
import { LoginRateLimiter } from "@/lib/login-rate-limit-core";
const limiter = new LoginRateLimiter({ maxAttempts: 10, windowMs: 60000 });
const catalogBudgetMs = 125_000;
export const runtime = "nodejs";
export const maxDuration = 150;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const startedAt = Date.now();
  const remainingMs = () => catalogBudgetMs - (Date.now() - startedAt);
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Inicia sessão." }, 401);
    if (!hasSameOrigin(request))
      return json({ error: "Pedido inválido." }, 403);
    const config = getAIConfig();
    if (!config.apiKey)
      return json(
        {
          error:
            "Configura a chave de IA no servidor. Podes preencher os valores manualmente.",
        },
        503,
      );
    const mode = request.headers.get("x-food-mode");
    if (mode !== "label" && mode !== "estimate")
      return json({ error: "Modo inválido." }, 400);
    if (!limiter.consume(String(user.id)).allowed)
      return json({ error: "Aguarda um minuto." }, 429);
    const photo = await readPhoto(request);
    if (
      !(await reserveAIQuota(db, user.id, lisbonDateKey(), config.dailyLimit))
    )
      return json(
        { error: "Limite diário de IA atingido. Continua manualmente." },
        429,
      );
    const result = await recognizeFood({
      photo,
      ...config,
      mode,
      signal: request.signal,
    });
    const identification = {
      barcode: result.barcode,
      name: result.product?.name ?? "",
      brand: result.product?.brand ?? "",
    };
    let candidates: FoodCandidate[] = [];
    if (identification.barcode && remainingMs() >= 3_000) {
      try {
        candidates = await lookupFood({
          barcode: identification.barcode,
          timeoutMs: Math.min(12_000, remainingMs()),
        });
      } catch {
        candidates = [];
      }
    }
    if (!candidates.length && identification.name && remainingMs() >= 6_000) {
      const term = [identification.name, identification.brand]
        .filter(Boolean)
        .join(" ");
      const left = remainingMs();
      const textBudget = Math.min(left, 24_000);
      const attempts = textBudget >= 22_000 ? 2 : 1;
      try {
        candidates = rankFoodCandidates(
          identification,
          await searchFoodByText({
            term,
            attempts,
            timeoutMs:
              attempts === 2 ? 10_000 : Math.max(1_000, textBudget - 1_000),
            delayMs: attempts === 2 ? 2_000 : 0,
          }),
        );
      } catch {
        candidates = [];
      }
    }
    return json({ ...result, candidates: candidates.slice(0, 3) });
  } catch (e) {
    return json(
      {
        error:
          e instanceof RecognitionError
            ? e.message
            : "Não foi possível analisar a fotografia. Tenta novamente.",
      },
      e instanceof RecognitionError ? e.status : 502,
    );
  }
}
