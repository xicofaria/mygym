/** Decimal keyboard input in pt-PT, without accepting exponents or hex. */
export function parseWeight(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}
