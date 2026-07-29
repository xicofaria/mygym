/* global self, caches, clients */

// This cache must contain public application code only. In particular, never
// add authenticated pages, API responses, Server Action responses or user data.
const CACHE_VERSION = "gym-public-v1";
const OFFLINE_URL = "/offline";
const OFFLINE_REQUEST = new Request(OFFLINE_URL, {
  credentials: "omit",
});

function isImmutableStaticAsset(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_next/static/") &&
    request.destination !== "document"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(
        new Request(OFFLINE_URL, {
          cache: "reload",
          credentials: "omit",
        }),
      );
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok || !contentType.includes("text/html")) {
        throw new Error("Não foi possível preparar a página offline.");
      }

      const cache = await caches.open(CACHE_VERSION);
      await cache.put(OFFLINE_REQUEST, response);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("gym-public-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      );
      await clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.origin !== self.location.origin) return;

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls and non-GET requests (including Server Actions) always go
  // directly to the network and are never observed or stored by this worker.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // HTML is always network-only. The sole exception is the explicitly public
  // offline shell, returned only when a page navigation cannot reach the server.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_REQUEST);
        return cached ?? Response.error();
      }),
    );
    return;
  }

  if (!isImmutableStaticAsset(request)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      const cacheControl = response.headers.get("cache-control") ?? "";
      const isImmutable = cacheControl
        .split(",")
        .some((directive) => directive.trim().toLowerCase() === "immutable");

      // Next.js content-hashed assets advertise themselves as immutable. Check
      // the response instead of trusting the path alone before persisting it.
      if (response.ok && isImmutable) {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
      }

      return response;
    })(),
  );
});
