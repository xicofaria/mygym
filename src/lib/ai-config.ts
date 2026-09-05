export type AIProvider = "openai" | "openrouter";
export function getAIConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const provider = env.AI_PROVIDER?.trim() || "openai";
  if (provider !== "openai" && provider !== "openrouter")
    throw new Error("AI_PROVIDER inválido.");
  const apiKey =
    (provider === "openrouter"
      ? env.OPENROUTER_API_KEY
      : env.OPENAI_API_KEY
    )?.trim() || "";
  const model =
    (provider === "openrouter"
      ? env.OPENROUTER_VISION_MODEL
      : env.OPENAI_VISION_MODEL
    )?.trim() ||
    (provider === "openrouter"
      ? "qwen/qwen3-vl-30b-a3b-instruct"
      : "gpt-4.1-mini");
  const dailyLimit = Number(env.AI_DAILY_LIMIT ?? 20);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000)
    throw new Error("AI_DAILY_LIMIT inválido.");
  return { provider: provider as AIProvider, apiKey, model, dailyLimit };
}
