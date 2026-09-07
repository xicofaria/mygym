import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  consumeEmailToken,
  createEmailToken,
  revokeEmailTokens,
} from "../../src/lib/email-tokens";

test("email tokens are single use, purpose bound, email bound and revocable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gym-email-tokens-"));
  const url = pathToFileURL(join(directory, "tokens.db")).href;
  const client = createClient({ url });
  const database = drizzle(client);
  try {
    await client.execute(
      "CREATE TABLE email_tokens (id integer PRIMARY KEY AUTOINCREMENT, user_id integer NOT NULL, purpose text NOT NULL, email text NOT NULL DEFAULT '', token_hash text NOT NULL UNIQUE, expires_at integer NOT NULL, used_at integer, created_at integer DEFAULT (unixepoch()) NOT NULL)",
    );

    const raw = await createEmailToken(database, 42, "verify_email", "a@t.pt");
    assert.match(raw, /^[0-9a-f]{64}$/);
    const rawAgain = await createEmailToken(database, 42, "verify_email", "a@t.pt");
    assert.notEqual(raw, rawAgain);

    // Email diferente do associado: recusado mesmo com token válido.
    assert.equal(
      await consumeEmailToken(database, raw, "verify_email", "b@t.pt"),
      null,
    );
    const consumed = await consumeEmailToken(database, raw, "verify_email", "a@t.pt");
    assert.deepEqual(consumed, { userId: 42 });
    assert.equal(await consumeEmailToken(database, raw, "verify_email", "a@t.pt"), null);
    assert.equal(await consumeEmailToken(database, raw, "password_reset", "a@t.pt"), null);
    const reusedForRightPurpose = await consumeEmailToken(
      database,
      rawAgain,
      "verify_email",
      "a@t.pt",
    );
    assert.deepEqual(reusedForRightPurpose, { userId: 42 });

    assert.equal(await consumeEmailToken(database, "", "verify_email", "a@t.pt"), null);
    assert.equal(
      await consumeEmailToken(database, "não-existe", "verify_email", "a@t.pt"),
      null,
    );

    // Alterações de credenciais revogam todos os tokens pendentes.
    const pending = await createEmailToken(database, 42, "password_reset", "a@t.pt");
    await revokeEmailTokens(database, 42);
    assert.equal(
      await consumeEmailToken(database, pending, "password_reset", "a@t.pt"),
      null,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("expired tokens are consumed but refuse to authorize", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gym-email-expired-"));
  const url = pathToFileURL(join(directory, "tokens.db")).href;
  const client = createClient({ url });
  const database = drizzle(client);
  try {
    await client.execute(
      "CREATE TABLE email_tokens (id integer PRIMARY KEY AUTOINCREMENT, user_id integer NOT NULL, purpose text NOT NULL, email text NOT NULL DEFAULT '', token_hash text NOT NULL UNIQUE, expires_at integer NOT NULL, used_at integer, created_at integer DEFAULT (unixepoch()) NOT NULL)",
    );
    const expiredAt = new Date(Date.now() - 60_000);
    const raw = "a".repeat(64);
    const tokenHash = (await import("node:crypto"))
      .createHash("sha256")
      .update(raw)
      .digest("hex");
    await client.execute({
      sql: "INSERT INTO email_tokens (user_id, purpose, email, token_hash, expires_at) VALUES (1, 'password_reset', 'a@t.pt', ?, ?)",
      args: [tokenHash, Math.floor(expiredAt.getTime() / 1000)],
    });
    assert.equal(
      await consumeEmailToken(database, raw, "password_reset", "a@t.pt"),
      null,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
