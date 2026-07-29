import "server-only";
import { LoginRateLimiter } from "./login-rate-limit-core";

const limiter = new LoginRateLimiter();

/**
 * Best-effort per-instance protection for the private two-user login. Vercel
 * Firewall or another shared rate limiter should remain the outer production
 * control because serverless instances do not share memory.
 */
export function consumeLoginAttempt(identifier: string, now = Date.now()) {
  return limiter.consume(identifier, now);
}

export function clearLoginAttempts(identifier: string) {
  limiter.clear(identifier);
}
