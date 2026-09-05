import assert from "node:assert/strict";
import test from "node:test";
import { getAIConfig } from "../../src/lib/ai-config";

test("selects only the chosen provider key and a vision default", () => {
  assert.equal(getAIConfig({}).provider, "openai");
  assert.equal(getAIConfig({ OPENROUTER_API_KEY: "unused" }).apiKey, "");
  assert.deepEqual(
    getAIConfig({
      AI_PROVIDER: "openrouter",
      OPENAI_API_KEY: "never-use",
      OPENROUTER_API_KEY: " test ",
    }),
    {
      provider: "openrouter",
      apiKey: "test",
      model: "qwen/qwen3-vl-30b-a3b-instruct",
      dailyLimit: 20,
    },
  );
  assert.equal(
    getAIConfig({
      AI_PROVIDER: "openrouter",
      OPENROUTER_VISION_MODEL: "custom/vision",
      AI_DAILY_LIMIT: "5",
    }).model,
    "custom/vision",
  );
});

test("invalid provider and quota fail closed", () => {
  assert.throws(() => getAIConfig({ AI_PROVIDER: "unknown" }));
  for (const value of ["0", "-1", "1.5", "NaN", "1001", ""]) {
    assert.throws(() => getAIConfig({ AI_DAILY_LIMIT: value }));
  }
});
