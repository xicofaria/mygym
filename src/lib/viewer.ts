/**
 * Resolves whose data the current page should show. Both users can view each
 * other's progress via a `?user=<id>` query param; anything invalid falls back
 * to the signed-in user. Writes always target the signed-in user (see actions).
 */
export function resolveViewedUserId(
  raw: string | string[] | undefined,
  currentUserId: number,
  allUserIds: number[],
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && allUserIds.includes(parsed)) return parsed;
  return currentUserId;
}
