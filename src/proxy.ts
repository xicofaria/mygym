import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy nonce.
 *
 * This is the one thing that has to run before rendering: Next reads the nonce
 * out of the request's CSP header during SSR and stamps it onto the framework
 * scripts it emits. Auth stays where it belongs — `requireUser()` in the
 * protected layout and at the top of every server action — so this file never
 * makes an authorization decision.
 */
export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced Next bootstrap load its own chunks, and
    // makes browsers that support it ignore the 'self' fallback above. React
    // needs eval in dev to rebuild server stack traces; it does not in prod.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Deliberately not nonce-based. A nonce only whitelists <style> elements,
    // never style="…" attributes — and Recharts styles its SVG that way, as do
    // progress-chart.tsx and body/page.tsx. 'style-src-attr' would be the
    // surgical fix but Safari support is patchy, and this is a phone-first PWA.
    // Scripts are where the XSS protection has to hold; styles are the tradeoff.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  // Next reads the nonce off the *request* header while rendering; the browser
  // enforces the copy on the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (request.nextUrl.pathname === "/sw.js") {
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Static assets carry no inline scripts, so they need no policy. Skipping
      // prefetches keeps every hovered link from minting a throwaway nonce.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
