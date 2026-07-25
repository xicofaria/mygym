import "server-only";
import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type AttemptWindow = { count: number; resetAt: number };
const attempts = new Map<string, AttemptWindow>();
const MAX_TRACKED_IDENTIFIERS = 1_000;

function keyFor(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex");
}

/**
 * Best-effort per-instance protection for the private two-user login. Vercel
 * Firewall or another shared rate limiter should remain the outer production
 * control because serverless instances do not share memory.
 */
export function consumeLoginAttempt(identifier: string, now = Date.now()) {
  const key = keyFor(identifier);
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    if (attempts.size >= MAX_TRACKED_IDENTIFIERS) {
      for (const [candidateKey, window] of attempts) {
        if (window.resetAt <= now) attempts.delete(candidateKey);
      }
      if (attempts.size >= MAX_TRACKED_IDENTIFIERS) {
        const oldestKey = attempts.keys().next().value;
        if (oldestKey) attempts.delete(oldestKey);
      }
    }
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearLoginAttempts(identifier: string) {
  attempts.delete(keyFor(identifier));
}
