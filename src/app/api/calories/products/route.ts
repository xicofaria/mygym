import { getCurrentUser } from "@/lib/auth";
import { lookupFood } from "@/lib/open-food-facts";
import { LoginRateLimiter } from "@/lib/login-rate-limit-core";
const limiter = new LoginRateLimiter({ maxAttempts: 4, windowMs: 60000 });
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Inicia sessão." }, { status: 401 });
  if (!limiter.consume(String(user.id)).allowed)
    return Response.json(
      { error: "Aguarda um minuto antes de pesquisar novamente." },
      { status: 429 },
    );
  const params = new URL(request.url).searchParams;
  try {
    const products = await lookupFood({
      barcode: params.get("barcode") ?? undefined,
      store: params.get("store") ?? undefined,
    });
    return Response.json(
      { products },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Não foi possível consultar produtos. Confirma o código ou adiciona manualmente.",
      },
      { status: 502 },
    );
  }
}
