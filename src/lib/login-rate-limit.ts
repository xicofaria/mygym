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

/**
 * Registration gets its own budget, deliberately separate from login.
 *
 * The threat models differ — creating accounts (and, with a provider, sending
 * mail to arbitrary addresses) rather than guessing one account's password —
 * and sharing the login instance let a burst of signup attempts lock the
 * targeted account out of signing in.
 *
 * It is configurable because one IP legitimately covers several people: a gym's
 * wifi, a household, and the E2E suite, which registers a handful of accounts
 * from 127.0.0.1. Same 1–1000 validation shape as AI_DAILY_LIMIT.
 */
const REGISTRATION_MAX_ATTEMPTS = (() => {
  const configured = Number(process.env.REGISTRATION_MAX_ATTEMPTS);
  return Number.isInteger(configured) && configured >= 1 && configured <= 1000
    ? configured
    : 10;
})();

const registrationLimiter = new LoginRateLimiter({
  maxAttempts: REGISTRATION_MAX_ATTEMPTS,
});

export function consumeRegistrationAttempt(
  identifier: string,
  now = Date.now(),
) {
  return registrationLimiter.consume(identifier, now);
}
