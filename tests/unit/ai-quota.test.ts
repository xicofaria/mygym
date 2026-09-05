import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { reserveAIQuota } from "../../src/lib/ai-quota";

test("quota is atomic across database clients, scoped per account and day", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gym-ai-quota-"));
  const url = pathToFileURL(join(directory, "quota.db")).href;
  const clients = [createClient({ url }), createClient({ url })];
  try {
    await clients[0].execute(
      "CREATE TABLE ai_usage (id integer PRIMARY KEY, user_id integer NOT NULL, day text NOT NULL, attempts integer NOT NULL, UNIQUE(user_id, day))",
    );
    const databases = clients.map((client) => drizzle(client));
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        reserveAIQuota(databases[i % 2], 1, "2026-09-05", 3),
      ),
    );
    assert.equal(results.filter(Boolean).length, 3);
    assert.equal(await reserveAIQuota(databases[1], 1, "2026-09-05", 3), false);
    assert.equal(await reserveAIQuota(databases[1], 2, "2026-09-05", 3), true);
    assert.equal(await reserveAIQuota(databases[1], 1, "2026-09-06", 3), true);
    await assert.rejects(reserveAIQuota(databases[0], 1, "2026-09-05", 0));
  } finally {
    clients.forEach((client) => client.close());
    await rm(directory, { recursive: true, force: true });
  }
});
