import assert from "node:assert/strict";
import test from "node:test";
import { hasSameOrigin } from "../../src/lib/request-origin";

test("uses public Host rather than Next's internal URL", () => {
  assert.equal(
    hasSameOrigin(
      new Request("http://localhost:3100/api", {
        headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
      }),
    ),
    true,
  );
  assert.equal(
    hasSameOrigin(
      new Request("http://localhost:3000/api", {
        headers: { host: "mygym.example", origin: "https://mygym.example" },
      }),
    ),
    true,
  );
});
test("rejects missing, malformed and foreign origins including port mismatches", () => {
  for (const origin of [
    "",
    "null",
    "https://foreign.test",
    "http://mygym.example:3001",
    "https://mygym.example/path",
    "https://mygym.example@foreign.test",
  ]) {
    assert.equal(
      hasSameOrigin(
        new Request("http://localhost/api", {
          headers: { host: "mygym.example", origin },
        }),
      ),
      false,
    );
  }
});
