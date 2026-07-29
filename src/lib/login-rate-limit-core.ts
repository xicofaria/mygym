import { createHash } from "node:crypto";

type AttemptWindow = { count: number; resetAt: number };

type LoginRateLimiterOptions = {
  windowMs?: number;
  maxAttempts?: number;
  maxTrackedIdentifiers?: number;
};

function keyFor(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex");
}

export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly maxTrackedIdentifiers: number;

  constructor({
    windowMs = 15 * 60 * 1000,
    maxAttempts = 5,
    maxTrackedIdentifiers = 1_000,
  }: LoginRateLimiterOptions = {}) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.maxTrackedIdentifiers = maxTrackedIdentifiers;
  }

  consume(identifier: string, now = Date.now()) {
    const key = keyFor(identifier);
    const current = this.attempts.get(key);

    if (!current || current.resetAt <= now) {
      if (this.attempts.size >= this.maxTrackedIdentifiers) {
        for (const [candidateKey, window] of this.attempts) {
          if (window.resetAt <= now) this.attempts.delete(candidateKey);
        }
        if (this.attempts.size >= this.maxTrackedIdentifiers) {
          const oldestKey = this.attempts.keys().next().value;
          if (oldestKey) this.attempts.delete(oldestKey);
        }
      }
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= this.maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  clear(identifier: string) {
    this.attempts.delete(keyFor(identifier));
  }
}
