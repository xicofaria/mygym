import { z } from "zod";
import { openRouterFormat } from "./openrouter-format";
import { MAX_PHOTO_BYTES } from "./recognition-contract";
import type { AIProvider } from "./ai-config";

export class RecognitionError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

/** Bound the actual stream, including requests without Content-Length. */
export async function readPhoto(request: Request): Promise<Buffer> {
  if (request.headers.get("content-type") !== "image/jpeg") {
    throw new RecognitionError("Envia uma fotografia JPEG.", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_PHOTO_BYTES) {
    throw new RecognitionError(
      "A fotografia é demasiado grande. Escolhe outra.",
      413,
    );
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RecognitionError("Escolhe uma fotografia.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_PHOTO_BYTES) {
        await reader.cancel();
        throw new RecognitionError(
          "A fotografia é demasiado grande. Escolhe outra.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  ) {
    throw new RecognitionError("A fotografia não é um JPEG válido.");
  }
  return bytes;
}

export type VisionFormat = ReturnType<typeof openRouterFormat>;

const ENDPOINT = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  openai: "https://api.openai.com/v1/responses",
} as const;

const routerEnvelope = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.literal("stop"),
        message: z.object({
          content: z.string(),
          refusal: z.null().optional(),
        }),
      }),
    )
    .min(1),
});

const openaiEnvelope = z.object({
  status: z.literal("completed"),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
    }),
  ),
});

/** Built once per analysis: a retry must share the original time budget. */
export function visionSignal({
  provider,
  format,
  signal,
}: {
  provider: AIProvider;
  format: VisionFormat;
  signal?: AbortSignal;
}): AbortSignal {
  return AbortSignal.any([
    AbortSignal.timeout(provider === "openrouter" ? format.timeoutMs : 25_000),
    ...(signal ? [signal] : []),
  ]);
}

/**
 * Transport shared by every vision feature: a new domain supplies a schema,
 * instructions, message parts and its own wording, never provider plumbing.
 * Provider bodies never reach the caller, so credentials and billing details
 * cannot leak through an error message.
 */
export async function requestVisionText({
  provider,
  apiKey,
  model,
  format,
  instructions,
  schemaName,
  schema,
  content,
  maxTokens,
  signal,
  fetcher,
  errors,
}: {
  provider: AIProvider;
  apiKey: string;
  model: string;
  format: VisionFormat;
  instructions: string;
  schemaName: string;
  schema: object;
  content: { openrouter: unknown[]; openai: unknown[] };
  maxTokens: { openrouter: number; openai: number };
  signal: AbortSignal;
  fetcher: typeof fetch;
  errors: { unavailable: (status: number) => string; incomplete: string };
}): Promise<string> {
  const body =
    provider === "openrouter"
      ? {
          model,
          max_tokens: maxTokens.openrouter,
          reasoning: format.reasoning,
          provider: { require_parameters: true, data_collection: "deny" },
          messages: [
            { role: "system", content: instructions + format.instruction },
            { role: "user", content: content.openrouter },
          ],
          response_format: format.response_format,
        }
      : {
          model,
          store: false,
          max_output_tokens: maxTokens.openai,
          instructions,
          input: [{ role: "user", content: content.openai }],
          text: {
            format: { type: "json_schema", name: schemaName, strict: true, schema },
          },
        };
  const response = await fetcher(ENDPOINT[provider], {
    method: "POST",
    cache: "no-store",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new RecognitionError(errors.unavailable(response.status), 502);
  const raw: unknown = await response.json();
  if (provider === "openrouter") {
    const parsed = routerEnvelope.safeParse(raw);
    if (!parsed.success) throw new RecognitionError(errors.incomplete, 502);
    return parsed.data.choices[0].message.content;
  }
  const parsed = openaiEnvelope.safeParse(raw);
  if (!parsed.success) throw new RecognitionError(errors.incomplete, 502);
  return parsed.data.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");
}
