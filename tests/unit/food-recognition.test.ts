import assert from "node:assert/strict";
import test from "node:test";
import { recognizeFood } from "../../src/lib/food-recognition";
import { emptyNutrients } from "../../src/lib/nutrition";
const photo = Buffer.from([255, 216, 255, 224]);
const value = {
  product: {
    name: "Iogurte",
    brand: "Teste",
    unit: "g",
    nutrients: { ...emptyNutrients, kcal: 80 },
  },
  explanation: "Confirma o rótulo.",
};
test("both food vision providers request strict per-100 output and do not infer portions", async () => {
  for (const provider of ["openai", "openrouter"] as const) {
    const result = await recognizeFood({
      photo,
      apiKey: "test-only",
      model: "test-model",
      provider,
      mode: "label",
      fetcher: async (url, options) => {
        const body = JSON.parse(String(options?.body));
        if (provider === "openai") {
          assert.equal(url, "https://api.openai.com/v1/responses");
          assert.equal(body.store, false);
          assert.match(body.instructions, /Não adivinhes a quantidade/);
          return Response.json({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: JSON.stringify(value) }],
              },
            ],
          });
        }
        assert.equal(body.provider.data_collection, "deny");
        assert.equal(body.response_format.json_schema.strict, true);
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(value) },
            },
          ],
        });
      },
    });
    assert.deepEqual(result, value);
  }
});
test("food analysis allows no match and rejects incomplete or invalid nutrition", async () => {
  const run = (body: unknown) =>
    recognizeFood({
      photo,
      apiKey: "test",
      model: "test",
      provider: "openrouter",
      mode: "estimate",
      fetcher: async () => Response.json(body),
    });
  const envelope = (content: unknown) => ({
    choices: [
      { finish_reason: "stop", message: { content: JSON.stringify(content) } },
    ],
  });
  assert.equal(
    (await run(envelope({ product: null, explanation: "Não é possível ler." })))
      .product,
    null,
  );
  await assert.rejects(
    run({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }),
  );
  await assert.rejects(
    run(
      envelope({
        ...value,
        product: {
          ...value.product,
          nutrients: { ...emptyNutrients, kcal: -100 },
        },
      }),
    ),
  );
});
