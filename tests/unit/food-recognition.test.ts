import assert from "node:assert/strict";
import test from "node:test";
import { recognizeFood } from "../../src/lib/food-recognition";
import { recognizeMachine } from "../../src/lib/machine-recognition";
import { openRouterFormat } from "../../src/lib/openrouter-format";
import { emptyNutrients, emptyProductDetails } from "../../src/lib/nutrition";
const photo = Buffer.from([255, 216, 255, 224]);
const value = {
  product: {
    name: "Iogurte",
    brand: "Teste",
    unit: "g",
    nutrients: { ...emptyNutrients, kcal: 80 },
    details: emptyProductDetails,
  },
  explanation: "Confirma o rótulo.",
};
test("package weight is structured separately from the per-100 base; prose is not parsed as weight", async () => {
  for (const quantity of [280, null]) {
    const result = await recognizeFood({
      photo,
      apiKey: "test",
      model: "z-ai/glm-5.3-flash",
      provider: "openrouter",
      mode: "estimate",
      fetcher: async (_url, options) => {
        const body = JSON.parse(String(options?.body));
        assert.match(body.messages[0].content, /nunca apenas na explanation/);
        assert.match(
          body.messages[0].content,
          /packageQuantity=280, packageEstimated=true/,
        );
        assert.match(
          body.messages[0].content,
          /sem indícios do conteúdo total, packageQuantity=null/,
        );
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({
                  ...value,
                  product: {
                    ...value.product,
                    details: {
                      ...emptyProductDetails,
                      packageQuantity: quantity,
                      packageEstimated: quantity !== null,
                    },
                  },
                  explanation:
                    "Porção de 280 g; confirma se corresponde à embalagem.",
                }),
              },
            },
          ],
        });
      },
    });
    assert.equal(result.product?.details.packageQuantity, quantity);
    assert.equal(result.product?.details.packageEstimated, quantity !== null);
    assert.equal(result.product?.nutrients.kcal, 80);
  }
});
test("diary unit suggestion sends text context without photo or diary and retains validation", async () => {
  for (const provider of ["openai", "openrouter"] as const) {
    const result = await recognizeFood({
      productContext: {
        name: value.product.name,
        brand: value.product.brand,
        unit: "g",
        nutrients: value.product.nutrients,
      },
      apiKey: "test",
      model: "test",
      provider,
      mode: "estimate",
      fetcher: async (_url, options) => {
        const body = JSON.parse(String(options?.body));
        const input =
          provider === "openrouter"
            ? body.messages[1].content
            : body.input[0].content;
        assert.equal(input.length, 1);
        assert.equal(
          input[0].type,
          provider === "openrouter" ? "text" : "input_text",
        );
        assert.equal(JSON.parse(input[0].text).name, value.product.name);
        assert.match(
          provider === "openrouter"
            ? body.messages[0].content
            : body.instructions,
          /sem fotografia/,
        );
        return Response.json(
          provider === "openrouter"
            ? {
                choices: [
                  {
                    finish_reason: "stop",
                    message: { content: JSON.stringify(value) },
                  },
                ],
              }
            : {
                status: "completed",
                output: [
                  {
                    type: "message",
                    content: [
                      { type: "output_text", text: JSON.stringify(value) },
                    ],
                  },
                ],
              },
        );
      },
    });
    assert.equal(result.product?.details.pieceQuantity, null);
  }
  await assert.rejects(
    recognizeFood({
      apiKey: "test",
      model: "test",
      provider: "openrouter",
      mode: "estimate",
      fetcher: async () => {
        throw new Error("must not call provider");
      },
    }),
  );
});
test("GLM max effort has a two-minute budget; unknown brand is normalized, not nutrients", async () => {
  const format = openRouterFormat("z-ai/glm-5.3-flash", "test", {});
  assert.equal(format.timeoutMs, 120000);
  assert.equal(format.foodTokens, 8000);
  assert.equal(format.reasoning?.effort, "max");
  assert.equal(openRouterFormat("other", "test", {}).timeoutMs, 25000);
  const result = await recognizeFood({
    photo,
    apiKey: "test",
    model: "z-ai/glm-5.3-flash",
    provider: "openrouter",
    mode: "label",
    fetcher: async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                ...value,
                product: { ...value.product, brand: null },
              }),
            },
          },
        ],
      }),
  });
  assert.equal(result.product?.brand, "");
  assert.equal(result.product?.nutrients.protein, null);
});
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
    assert.deepEqual(result, { ...value, barcode: null });
  }
});
test("GLM uses JSON mode with schema instructions and validates both vision flows", async () => {
  const fetcher: typeof fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.response_format.type, "json_object");
    assert.deepEqual(body.reasoning, { effort: "max", exclude: true });
    assert.equal(body.provider.require_parameters, true);
    assert.equal(body.provider.data_collection, "deny");
    assert.match(body.messages[0].content, /schema:/);
    const food = body.messages[0].content.includes("nutrientEstimates");
    if (food) {
      assert.match(body.messages[0].content, /100\/peso da porção/);
      assert.match(body.messages[0].content, /Sem escala/);
    }
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify(
              food
                ? value
                : { candidates: [], explanation: "Sem correspondência." },
            ),
          },
        },
      ],
    });
  };
  const config = {
    photo,
    apiKey: "test",
    model: "z-ai/glm-5.3-flash",
    provider: "openrouter" as const,
    fetcher,
  };
  assert.deepEqual(
    (await recognizeFood({ ...config, mode: "estimate" })).product,
    value.product,
  );
  assert.deepEqual(
    (await recognizeMachine({ ...config, catalog: [{ id: 1, name: "Teste" }] }))
      .candidates,
    [],
  );
  await assert.rejects(
    recognizeFood({
      ...config,
      mode: "estimate",
      fetcher: async () =>
        Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: '{"product":{"name":"invented"}}' },
            },
          ],
        }),
    }),
  );
});
test("strict label mode rejects estimated fields, estimate mode preserves provenance", async () => {
  const product = {
    ...value.product,
    details: {
      ...emptyProductDetails,
      packageQuantity: 200,
      packageEstimated: true,
      nutrientEstimates: ["protein"],
    },
  };
  const config = {
    photo,
    apiKey: "test",
    model: "test",
    provider: "openrouter" as const,
    fetcher: async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ ...value, product }) },
          },
        ],
      }),
  };
  assert.deepEqual(
    (await recognizeFood({ ...config, mode: "estimate" })).product?.details,
    product.details,
  );
  await assert.rejects(recognizeFood({ ...config, mode: "label" }));
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
test("barcode is optional metadata: absent or malformed digits become null, valid digits are kept", async () => {
  const run = (barcode: unknown) =>
    recognizeFood({
      photo,
      apiKey: "test",
      model: "test",
      provider: "openrouter",
      mode: "estimate",
      fetcher: async (_url, options) => {
        const body = JSON.parse(String(options?.body));
        assert.match(body.messages[0].content, /Nunca inventes nem adivinhes/);
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({ ...value, barcode }),
              },
            },
          ],
        });
      },
    });
  assert.equal((await run("5601234567890")).barcode, "5601234567890");
  assert.equal((await run("12345")).barcode, null);
  assert.equal((await run("https://evil.test")).barcode, null);
  assert.equal((await run(null)).barcode, null);
  assert.equal((await run(undefined)).barcode, null);
});
test("malformed provider JSON is retried once; validation failures are not retried", async () => {
  let calls = 0;
  const recovered = await recognizeFood({
    photo,
    apiKey: "test",
    model: "test",
    provider: "openrouter",
    mode: "estimate",
    fetcher: async () => {
      calls++;
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                calls === 1
                  ? '{"barcode":null,"product":null,"expl'
                  : JSON.stringify({ ...value, barcode: null }),
            },
          },
        ],
      });
    },
  });
  assert.equal(calls, 2);
  assert.equal(recovered.product?.name, "Iogurte");
  let repeated = 0;
  await assert.rejects(
    recognizeFood({
      photo,
      apiKey: "test",
      model: "test",
      provider: "openrouter",
      mode: "estimate",
      fetcher: async () => {
        repeated++;
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: { content: "{burro" },
            },
          ],
        });
      },
    }),
  );
  assert.equal(repeated, 2);
  let once = 0;
  await assert.rejects(
    recognizeFood({
      photo,
      apiKey: "test",
      model: "test",
      provider: "openrouter",
      mode: "estimate",
      fetcher: async () => {
        once++;
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({
                  ...value,
                  product: { ...value.product, nutrients: { ...emptyNutrients, kcal: -1 } },
                }),
              },
            },
          ],
        });
      },
    }),
  );
  assert.equal(once, 1);
});
test("the provider timeout budget is shared across the malformed-JSON retry", async () => {
  const signals: unknown[] = [];
  let calls = 0;
  const result = await recognizeFood({
    photo,
    apiKey: "test",
    model: "z-ai/glm-5.3-flash",
    provider: "openrouter",
    mode: "estimate",
    fetcher: async (_url, options) => {
      calls++;
      signals.push(options?.signal);
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                calls === 1
                  ? "{truncado"
                  : JSON.stringify({ ...value, barcode: null }),
            },
          },
        ],
      });
    },
  });
  assert.equal(calls, 2);
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(signals[0], signals[1]);
  assert.equal(result.product?.name, "Iogurte");
});
