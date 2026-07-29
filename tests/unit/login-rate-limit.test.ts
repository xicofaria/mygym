import assert from "node:assert/strict";
import test from "node:test";
import { LoginRateLimiter } from "../../src/lib/login-rate-limit-core";

test("blocks an identifier after the configured number of attempts", () => {
  const limiter = new LoginRateLimiter({ windowMs: 60_000, maxAttempts: 2 });

  assert.deepEqual(limiter.consume("127.0.0.1:user@example.com", 1_000), {
    allowed: true,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.consume("127.0.0.1:user@example.com", 2_000), {
    allowed: true,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.consume("127.0.0.1:user@example.com", 3_000), {
    allowed: false,
    retryAfterSeconds: 58,
  });
});

test("resets an identifier when its attempt window expires", () => {
  const limiter = new LoginRateLimiter({ windowMs: 1_000, maxAttempts: 1 });

  assert.equal(limiter.consume("ip:user@example.com", 5_000).allowed, true);
  assert.equal(limiter.consume("ip:user@example.com", 5_500).allowed, false);
  assert.equal(limiter.consume("ip:user@example.com", 6_000).allowed, true);
});

test("clears attempts after a successful login", () => {
  const limiter = new LoginRateLimiter({ maxAttempts: 1 });

  assert.equal(limiter.consume("ip:user@example.com", 1_000).allowed, true);
  assert.equal(limiter.consume("ip:user@example.com", 2_000).allowed, false);
  limiter.clear("ip:user@example.com");
  assert.equal(limiter.consume("ip:user@example.com", 3_000).allowed, true);
});

test("tracks different IP and email identifiers independently", () => {
  const limiter = new LoginRateLimiter({ maxAttempts: 1 });

  assert.equal(limiter.consume("ip-a:user@example.com", 1_000).allowed, true);
  assert.equal(limiter.consume("ip-a:user@example.com", 2_000).allowed, false);
  assert.equal(limiter.consume("ip-b:user@example.com", 2_000).allowed, true);
  assert.equal(limiter.consume("ip-a:other@example.com", 2_000).allowed, true);
});
