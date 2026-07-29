import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

type WorkerListener = (event: unknown) => void;
type FetchEvent = {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
};

function loadWorker(fetchImpl: typeof fetch) {
  class ServiceWorkerRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(
        typeof input === "string"
          ? new URL(input, "https://gym.example")
          : input,
        init,
      );
    }
  }

  const listeners = new Map<string, WorkerListener>();
  const stored: { request: Request; response: Response }[] = [];
  const offlineResponse = new Response("offline");
  let skipWaitingCalls = 0;

  const cache = {
    put: async (request: Request, response: Response) => {
      stored.push({ request, response });
    },
  };
  const cacheStorage = {
    keys: async () => [],
    delete: async () => true,
    open: async () => cache,
    match: async (request: Request) =>
      new URL(request.url).pathname === "/offline"
        ? offlineResponse.clone()
        : undefined,
  };
  const worker = {
    location: { origin: "https://gym.example" },
    addEventListener: (type: string, listener: WorkerListener) => {
      listeners.set(type, listener);
    },
    skipWaiting: async () => {
      skipWaitingCalls += 1;
    },
  };

  const source = readFileSync(
    new URL("../../public/sw.js", import.meta.url),
    "utf8",
  );
  runInNewContext(source, {
    self: worker,
    caches: cacheStorage,
    clients: { claim: async () => undefined },
    fetch: fetchImpl,
    Request: ServiceWorkerRequest,
    Response,
    URL,
    Error,
    Promise,
  });

  const fetchListener = listeners.get("fetch");
  assert.ok(fetchListener, "o service worker deve registar o evento fetch");
  const messageListener = listeners.get("message");
  assert.ok(messageListener, "o service worker deve registar o evento message");
  return {
    fetchListener,
    messageListener,
    skipWaitingCalls: () => skipWaitingCalls,
    stored,
  };
}

function dispatchFetch(
  listener: WorkerListener,
  request: Request,
): Promise<Response> | undefined {
  let result: Promise<Response> | undefined;
  const event: FetchEvent = {
    request,
    respondWith(response) {
      result = Promise.resolve(response);
    },
  };
  listener(event);
  return result;
}

test("não interceta API nem pedidos de escrita", () => {
  let networkCalls = 0;
  const { fetchListener, stored } = loadWorker(async () => {
    networkCalls += 1;
    return new Response("network");
  });

  const apiResult = dispatchFetch(
    fetchListener,
    new Request("https://gym.example/api/private"),
  );
  const postResult = dispatchFetch(
    fetchListener,
    new Request("https://gym.example/workouts", { method: "POST" }),
  );

  assert.equal(apiResult, undefined);
  assert.equal(postResult, undefined);
  assert.equal(networkCalls, 0);
  assert.equal(stored.length, 0);
});

test("aceita pedidos de atualização apenas da própria origem", () => {
  const worker = loadWorker(async () => new Response("network"));

  worker.messageListener({
    data: { type: "SKIP_WAITING" },
    origin: "https://evil.example",
  });
  assert.equal(worker.skipWaitingCalls(), 0);

  worker.messageListener({
    data: { type: "SKIP_WAITING" },
    origin: "https://gym.example",
  });
  assert.equal(worker.skipWaitingCalls(), 1);
});

test("usa apenas a shell pública quando uma navegação falha", async () => {
  const { fetchListener, stored } = loadWorker(async () => {
    throw new TypeError("offline");
  });
  const navigation = {
    method: "GET",
    mode: "navigate",
    url: "https://gym.example/workouts",
  } as Request;

  const result = dispatchFetch(fetchListener, navigation);
  assert.ok(result);
  assert.equal(await (await result).text(), "offline");
  assert.equal(stored.length, 0);
});

test("guarda assets Next apenas quando são imutáveis", async () => {
  const { fetchListener, stored } = loadWorker(async () =>
    new Response("chunk", {
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }),
  );
  const request = new Request(
    "https://gym.example/_next/static/chunks/abc123.js",
  );

  const result = dispatchFetch(fetchListener, request);
  assert.ok(result);
  assert.equal(await (await result).text(), "chunk");
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.request.url, request.url);

  const mutable = loadWorker(async () =>
    new Response("chunk", {
      headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
    }),
  );
  const mutableResult = dispatchFetch(mutable.fetchListener, request);
  assert.ok(mutableResult);
  await mutableResult;
  assert.equal(mutable.stored.length, 0);
});
