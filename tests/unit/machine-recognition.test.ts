import assert from "node:assert/strict";
import test from "node:test";
import {
  readPhoto,
  recognizeMachine,
  RecognitionError,
} from "../../src/lib/machine-recognition";
import { MAX_PHOTO_BYTES } from "../../src/lib/recognition-contract";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
const routerEnvelope = (value: unknown, finish_reason = "stop") => ({
  choices: [{ finish_reason, message: { content: JSON.stringify(value) } }],
});
const catalog = [{ id: 7, name: "Leg Press", muscleGroup: "Pernas" }];
const valid = {
  candidates: [{ exerciseId: 7, confidence: "high" }],
  explanation: "Parece uma prensa de pernas.",
};
const envelope = (result: unknown) => ({
  status: "completed",
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(result) }],
    },
  ],
});
const run = (body: unknown, status = 200) =>
  recognizeMachine({
    photo: jpeg,
    catalog,
    apiKey: "test-only",
    model: "test-model",
    fetcher: async () => Response.json(body, { status }),
  });

test("OpenRouter sends vision content, strict catalogue schema and privacy routing", async () => {
  const result = await recognizeMachine({
    photo: jpeg,
    catalog,
    apiKey: "router-test",
    model: "qwen/test-vision",
    provider: "openrouter",
    fetcher: async (url, options) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(
        new Headers(options?.headers).get("authorization"),
        "Bearer router-test",
      );
      const body = JSON.parse(String(options?.body));
      assert.equal(body.model, "qwen/test-vision");
      assert.deepEqual(body.provider, {
        require_parameters: true,
        data_collection: "deny",
      });
      assert.equal(
        body.messages[1].content[1].image_url.url,
        `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      );
      assert.equal(body.response_format.json_schema.strict, true);
      assert.deepEqual(
        body.response_format.json_schema.schema.properties.candidates.items
          .properties.exerciseId.enum,
        [7],
      );
      return Response.json(routerEnvelope(valid));
    },
  });
  assert.deepEqual(result, { ...valid, suggestion: null });
});

test("OpenRouter rejects truncation, refusals and bad JSON; accepts no match", async () => {
  for (const body of [
    routerEnvelope(valid, "length"),
    {
      choices: [
        {
          finish_reason: "stop",
          message: { content: "{}", refusal: "refused" },
        },
      ],
    },
    { choices: [{ finish_reason: "stop", message: { content: "not json" } }] },
  ]) {
    await assert.rejects(
      recognizeMachine({
        photo: jpeg,
        catalog,
        apiKey: "test",
        model: "test",
        provider: "openrouter",
        fetcher: async () => Response.json(body),
      }),
      RecognitionError,
    );
  }
  const result = await recognizeMachine({
    photo: jpeg,
    catalog,
    apiKey: "test",
    model: "test",
    provider: "openrouter",
    fetcher: async () =>
      Response.json(
        routerEnvelope({ candidates: [], explanation: "Sem correspondência." }),
      ),
  });
  assert.deepEqual(result.candidates, []);
});

test("validates JPEG signature, MIME and actual streamed size", async () => {
  assert.deepEqual(
    await readPhoto(
      new Request("https://local.test", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: jpeg,
      }),
    ),
    jpeg,
  );
  for (const [type, body, status] of [
    ["image/png", jpeg, 415],
    ["image/jpeg", Buffer.from("not an image"), 400],
    ["image/jpeg", Buffer.alloc(MAX_PHOTO_BYTES + 1), 413],
  ] as const) {
    await assert.rejects(
      readPhoto(
        new Request("https://local.test", {
          method: "POST",
          headers: { "Content-Type": type },
          body,
        }),
      ),
      (e: unknown) => e instanceof RecognitionError && e.status === status,
    );
  }
});

test("uses fixed provider URL, server catalog and non-stored structured response", async () => {
  const result = await recognizeMachine({
    photo: jpeg,
    catalog,
    apiKey: "test-only",
    model: "test-model",
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(options?.body));
      assert.equal(body.store, false);
      assert.equal(body.model, "test-model");
      assert.equal(body.text.format.strict, true);
      assert.deepEqual(
        body.text.format.schema.properties.candidates.items.properties
          .exerciseId.enum,
        [7],
      );
      assert.equal(
        body.input[0].content[1].image_url,
        `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      );
      assert.ok(options?.signal);
      return Response.json(envelope(valid));
    },
  });
  assert.deepEqual(result, { ...valid, suggestion: null });
});

test("an unmatched machine returns the creation proposal for explicit confirmation", async () => {
  const result = await run(
    envelope({
      candidates: [],
      suggestion: {
        name: "Pec Deck",
        muscleGroup: "Peito",
        aliases: "Voador, Borboleta",
        equipment: "Máquina",
      },
      explanation: "Máquina de aberturas sem correspondência.",
    }),
  );
  assert.deepEqual(result.suggestion, {
    name: "Pec Deck",
    muscleGroup: "Peito",
    aliases: "Voador, Borboleta",
    equipment: "Máquina",
  });
  assert.deepEqual(result.candidates, []);
});

test("a proposal that matches the catalogue becomes an existing candidate instead", async () => {
  const result = await run(
    envelope({
      candidates: [],
      suggestion: {
        name: "Leg Press",
        muscleGroup: "Pernas",
        aliases: "",
        equipment: "Máquina",
      },
      explanation: "Parece a prensa existente.",
    }),
  );
  assert.equal(result.suggestion, null);
  assert.deepEqual(result.candidates, [
    { exerciseId: 7, confidence: "medium" },
  ]);
});

test("malformed proposals degrade instead of failing the analysis; prompt asks for creation", async () => {
  const prompt = await new Promise<string>((resolve) => {
    void recognizeMachine({
      photo: jpeg,
      catalog,
      apiKey: "test",
      model: "test",
      provider: "openrouter",
      fetcher: async (_url, options) => {
        const body = JSON.parse(String(options?.body));
        resolve(String(body.messages[0].content));
        return Response.json(
          routerEnvelope({ candidates: [], explanation: "Sem match." }),
        );
      },
    });
  });
  assert.match(prompt, /devolve também suggestion/);
  assert.match(prompt, /depende de confirmação do utilizador/);
  for (const suggestion of [
    { name: "", muscleGroup: "Peito", aliases: "", equipment: "Máquina" },
    {
      name: "Pec Deck",
      muscleGroup: "Peito",
      aliases: "",
      equipment: "machine",
    },
  ]) {
    const result = await run(
      envelope({ candidates: [], suggestion, explanation: "…" }),
    );
    if (suggestion.name) {
      assert.deepEqual(result.suggestion?.equipment, "");
    } else {
      assert.equal(result.suggestion, null);
    }
  }
});

test("accepts no match, drops hallucinated and duplicate IDs, caps candidates", async () => {
  assert.deepEqual(
    (
      await run(
        envelope({ candidates: [], explanation: "Sem equipamento visível." }),
      )
    ).candidates,
    [],
  );
  const messy = await run(
    envelope({
      candidates: [
        { exerciseId: 999, confidence: "high" },
        valid.candidates[0],
        valid.candidates[0],
        { exerciseId: "7", confidence: "high" },
        { exerciseId: 7, confidence: "urgent" },
      ],
      explanation: "vária música no meio",
    }),
  );
  assert.deepEqual(messy.candidates, [
    { exerciseId: 7, confidence: "high" },
  ]);
  const capped = await run(
    envelope({
      candidates: [
        { exerciseId: 7, confidence: "low" },
        { exerciseId: 7, confidence: "high" },
      ],
      explanation: "duas entradas iguais",
    }),
  );
  assert.deepEqual(capped.candidates, [
    { exerciseId: 7, confidence: "low" },
  ]);
});

test("tolerates fenced JSON, long explanations and odd confidence casing", async () => {
  const fenced = await recognizeMachine({
    photo: jpeg,
    catalog,
    apiKey: "test",
    model: "test",
    provider: "openrouter",
    fetcher: async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "```json\n" +
                JSON.stringify({
                  ...valid,
                  suggestion: null,
                  explanation: "x".repeat(600),
                }) +
                "\n```",
            },
          },
        ],
      }),
  });
  assert.deepEqual(fenced.candidates, valid.candidates);
  assert.equal(fenced.explanation.length, 400);
  const shouting = await run(
    envelope({
      candidates: [{ exerciseId: 7, confidence: "HIGH" }],
      explanation: "",
    }),
  );
  assert.deepEqual(shouting.candidates, [
    { exerciseId: 7, confidence: "high" },
  ]);
  assert.equal(shouting.explanation, "Confirma o exercício na lista.");
});

test("handles refusals, incomplete and provider errors without leaking details", async () => {
  for (const body of [
    { status: "incomplete", output: [] },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    },
  ]) {
    await assert.rejects(run(body), RecognitionError);
  }
  for (const status of [401, 429, 500]) {
    await assert.rejects(
      run({ error: "private billing or credential detail" }, status),
      (error: unknown) =>
        error instanceof RecognitionError && !error.message.includes("private"),
    );
  }
  const empty = await run(envelope({ unexpected: true }));
  assert.deepEqual(empty.candidates, []);
  assert.equal(empty.suggestion, null);
  assert.equal(empty.explanation, "Confirma o exercício na lista.");
});

test("network aborts propagate and empty catalog never calls provider", async () => {
  await assert.rejects(
    recognizeMachine({
      photo: jpeg,
      catalog: [],
      apiKey: "test",
      model: "test",
      fetcher: async () => {
        assert.fail("No provider call expected");
      },
    }),
    RecognitionError,
  );
  await assert.rejects(
    recognizeMachine({
      photo: jpeg,
      catalog,
      apiKey: "test",
      model: "test",
      fetcher: async () => {
        throw new DOMException("timeout", "AbortError");
      },
    }),
    { name: "AbortError" },
  );
});
