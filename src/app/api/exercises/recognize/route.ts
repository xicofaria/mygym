import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { LoginRateLimiter } from "@/lib/login-rate-limit-core";
import {
  readPhoto,
  recognizeMachine,
  RecognitionError,
} from "@/lib/machine-recognition";
import { hasSameOrigin } from "@/lib/request-origin";
import { getAIConfig } from "@/lib/ai-config";
import { reserveAIQuota } from "@/lib/ai-quota";
import { lisbonDateKey } from "@/lib/format";
import { enrichExercise } from "@/lib/exercise-catalog";

export const runtime = "nodejs";
export const maxDuration = 150;
// Best effort per instance, like login. Configure a shared edge limit in production.
const limiter = new LoginRateLimiter({ maxAttempts: 10, windowMs: 60_000 });
const json = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return json({ error: "Inicia sessão para identificar a máquina." }, 401);
    // This paid endpoint accepts browser requests only from the same origin.
    if (!hasSameOrigin(request)) {
      return json({ error: "Pedido inválido. Reabre a aplicação." }, 403);
    }
    const { apiKey, provider, model, dailyLimit } = getAIConfig();
    if (!apiKey)
      return json(
        {
          error:
            "A identificação por fotografia ainda não está configurada. Podes escolher o exercício na lista.",
        },
        503,
      );
    const attempt = limiter.consume(String(user.id));
    if (!attempt.allowed)
      return json(
        {
          error: "Demasiadas fotografias. Aguarda um minuto e tenta novamente.",
        },
        429,
        { "Retry-After": String(attempt.retryAfterSeconds) },
      );
    const photo = await readPhoto(request);
    const catalog = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        muscleGroup: exercises.muscleGroup,
        aliases: exercises.aliases,
        equipment: exercises.equipment,
      })
      .from(exercises)
      .orderBy(exercises.name)
      .limit(501)
      .all();
    if (catalog.length > 500)
      return json(
        {
          error:
            "O catálogo é demasiado grande para esta análise. Escolhe na lista.",
        },
        503,
      );
    if (!catalog.length)
      return json({ error: "Adiciona primeiro exercícios ao catálogo." }, 400);
    if (!(await reserveAIQuota(db, user.id, lisbonDateKey(), dailyLimit))) {
      return json(
        {
          error:
            "Atingiste o limite diário de fotografias. Podes continuar a escolher na lista e voltar a analisar amanhã.",
        },
        429,
      );
    }
    return json(
      await recognizeMachine({
        photo,
        catalog: catalog.map(enrichExercise),
        apiKey,
        provider,
        model,
        signal: request.signal,
      }),
    );
  } catch (error) {
    if (error instanceof RecognitionError)
      return json({ error: error.message }, error.status);
    return json(
      {
        error:
          "Não foi possível analisar a fotografia. Tenta novamente ou escolhe na lista.",
      },
      502,
    );
  }
}
