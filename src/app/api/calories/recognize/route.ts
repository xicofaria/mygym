import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { getAIConfig } from "@/lib/ai-config";
import { reserveAIQuota } from "@/lib/ai-quota";
import { lisbonDateKey } from "@/lib/format";
import { hasSameOrigin } from "@/lib/request-origin";
import { readPhoto, RecognitionError } from "@/lib/machine-recognition";
import { recognizeFood } from "@/lib/food-recognition";
import { LoginRateLimiter } from "@/lib/login-rate-limit-core";
const limiter = new LoginRateLimiter({ maxAttempts: 10, windowMs: 60000 });
export const runtime = "nodejs";
export const maxDuration = 150;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
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
    return json(
      await recognizeFood({ photo, ...config, mode, signal: request.signal }),
    );
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
