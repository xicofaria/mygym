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
  assert.deepEqual(result, valid);
});

test("OpenRouter rejects truncation, refusals, bad JSON and unknown IDs; accepts no match", async () => {
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
    routerEnvelope({
      ...valid,
      candidates: [{ exerciseId: 999, confidence: "high" }],
    }),
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
  assert.deepEqual(result, valid);
});

test("accepts no match and rejects hallucinated or duplicate IDs", async () => {
  assert.deepEqual(
    (
      await run(
        envelope({ candidates: [], explanation: "Sem equipamento visível." }),
      )
    ).candidates,
    [],
  );
  for (const candidates of [
    [{ exerciseId: 999, confidence: "high" }],
    [valid.candidates[0], valid.candidates[0]],
  ]) {
    await assert.rejects(
      run(envelope({ ...valid, candidates })),
      RecognitionError,
    );
  }
});

test("handles refusals, incomplete, malformed and provider errors without leaking details", async () => {
  for (const body of [
    { status: "incomplete", output: [] },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    },
    envelope({ unexpected: true }),
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
