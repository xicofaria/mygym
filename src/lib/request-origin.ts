/** Next may build request.url with its internal listener hostname. */
export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.origin === origin &&
      parsed.host === host
    );
  } catch {
    return false;
  }
}
