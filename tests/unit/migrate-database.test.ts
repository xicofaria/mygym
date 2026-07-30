import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { readMigrationFiles } from "drizzle-orm/migrator";
import test from "node:test";
import { migrateDatabase } from "../../scripts/migrate-database";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATIONS_FOLDER = join(REPOSITORY_ROOT, "drizzle");

async function withTemporaryDatabase(
  run: (database: { url: string; path: string }) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "gym-migrations-"));
  const path = join(directory, "test.db");

  try {
    await run({ url: pathToFileURL(path).href, path });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function migrationStatements(index: number): string[] {
  const migrations = readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
  });
  const migration = migrations[index];
  assert.ok(migration, `A migração ${index} devia existir.`);
  return migration.sql.map((statement) => statement.trim()).filter(Boolean);
}

async function createLegacyDatabase(client: Client): Promise<void> {
  await client.migrate(migrationStatements(0));
  await client.batch(
    [
      {
        sql: `
          INSERT INTO users (id, email, name, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [1, "legacy@example.test", "Legacy", "hash", 1_700_000_000],
      },
      {
        sql: `
          INSERT INTO workout_templates (id, user_id, name, created_at)
          VALUES (?, ?, ?, ?)
        `,
        args: [10, 1, "Treino legado", 1_700_000_001],
      },
      {
        sql: `
          INSERT INTO workouts (id, user_id, date, notes, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [100, 1, 1_700_100_000, "Sessão inequívoca", 1_700_100_100],
      },
      {
        sql: `
          INSERT INTO workouts (id, user_id, date, notes, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [101, 1, 1_700_200_000, "Sessão ambígua A", 1_700_200_100],
      },
      {
        sql: `
          INSERT INTO workouts (id, user_id, date, notes, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [102, 1, 1_700_200_000, "Sessão ambígua B", 1_700_200_200],
      },
      {
        sql: `
          INSERT INTO planned_workouts
            (id, user_id, date, template_id, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [200, 1, 1_700_100_000, 10, "Plano inequívoco", 1_700_100_010],
      },
      {
        sql: `
          INSERT INTO planned_workouts
            (id, user_id, date, template_id, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [201, 1, 1_700_200_000, 10, "Plano ambíguo A", 1_700_200_010],
      },
      {
        sql: `
          INSERT INTO planned_workouts
            (id, user_id, date, template_id, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [202, 1, 1_700_200_000, 10, "Plano ambíguo B", 1_700_200_020],
      },
      {
        sql: `
          INSERT INTO planned_workouts
            (id, user_id, date, template_id, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [999, 1, 1_700_900_000, 10, "Plano já apagado", 1_700_900_010],
      },
      {
        sql: "DELETE FROM planned_workouts WHERE id = ?",
        args: [999],
      },
      {
        sql: `
          INSERT INTO planned_workout_groups
            (id, planned_workout_id, name, position)
          VALUES (?, ?, ?, ?)
        `,
        args: [300, 200, "Peito", 0],
      },
    ],
    "write",
  );
}

async function createCurrentDatabaseWithoutLedger(client: Client): Promise<void> {
  const migrations = readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
  });
  for (const migration of migrations) {
    await client.migrate(
      migration.sql.map((statement) => statement.trim()).filter(Boolean),
    );
  }
}

async function readLedger(client: Client) {
  return client.execute(
    "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, rowid",
  );
}

test("migra uma base vazia e valida o schema e o ledger atuais", async () => {
  await withTemporaryDatabase(async ({ url }) => {
    const result = await migrateDatabase({
      url,
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    assert.deepEqual(result, {
      initialState: "empty",
      migrationsApplied: 2,
      ledgerImported: false,
    });

    const client = createClient({ url });
    try {
      const columns = await client.execute("PRAGMA table_info(planned_workouts)");
      assert.deepEqual(
        columns.rows.map((row) => row.name),
        [
          "id",
          "user_id",
          "date",
          "template_id",
          "workout_id",
          "routine_date",
          "notes",
          "created_at",
        ],
      );

      const foreignKeys = await client.execute(
        "PRAGMA foreign_key_list(planned_workouts)",
      );
      assert.deepEqual(
        foreignKeys.rows
          .map((row) => ({
            from: row.from,
            table: row.table,
            onDelete: row.on_delete,
          }))
          .sort((left, right) => String(left.from).localeCompare(String(right.from))),
        [
          { from: "template_id", table: "workout_templates", onDelete: "SET NULL" },
          { from: "user_id", table: "users", onDelete: "CASCADE" },
          { from: "workout_id", table: "workouts", onDelete: "SET NULL" },
        ],
      );

      const indexes = await client.execute("PRAGMA index_list(planned_workouts)");
      assert.deepEqual(
        indexes.rows
          .filter((row) => row.unique === 1)
          .map((row) => row.name)
          .sort(),
        [
          "planned_workouts_user_routine_date_unique",
          "planned_workouts_workout_id_unique",
        ],
      );

      const expectedMigrations = readMigrationFiles({
        migrationsFolder: MIGRATIONS_FOLDER,
      });
      const ledger = await readLedger(client);
      assert.deepEqual(
        ledger.rows.map((row) => ({
          hash: row.hash,
          createdAt: Number(row.created_at),
        })),
        expectedMigrations.map((migration) => ({
          hash: migration.hash,
          createdAt: migration.folderMillis,
        })),
      );
      assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    } finally {
      client.close();
    }
  });
});

test("migra o legado sem perder dados ou filhos e só faz backfill inequívoco", async () => {
  await withTemporaryDatabase(async ({ url }) => {
    const setup = createClient({ url });
    try {
      await createLegacyDatabase(setup);
    } finally {
      setup.close();
    }

    const result = await migrateDatabase({
      url,
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    assert.equal(result.initialState, "legacy-without-ledger");
    assert.equal(result.migrationsApplied, 2);

    const client = createClient({ url });
    try {
      const plans = await client.execute(`
        SELECT id, user_id, date, template_id, workout_id, routine_date, notes, created_at
        FROM planned_workouts
        ORDER BY id
      `);
      assert.deepEqual(
        plans.rows.map((row) => ({
          id: Number(row.id),
          userId: Number(row.user_id),
          date: Number(row.date),
          templateId: Number(row.template_id),
          workoutId: row.workout_id === null ? null : Number(row.workout_id),
          routineDate:
            row.routine_date === null ? null : Number(row.routine_date),
          notes: row.notes,
          createdAt: Number(row.created_at),
        })),
        [
          {
            id: 200,
            userId: 1,
            date: 1_700_100_000,
            templateId: 10,
            workoutId: 100,
            routineDate: null,
            notes: "Plano inequívoco",
            createdAt: 1_700_100_010,
          },
          {
            id: 201,
            userId: 1,
            date: 1_700_200_000,
            templateId: 10,
            workoutId: null,
            routineDate: null,
            notes: "Plano ambíguo A",
            createdAt: 1_700_200_010,
          },
          {
            id: 202,
            userId: 1,
            date: 1_700_200_000,
            templateId: 10,
            workoutId: null,
            routineDate: null,
            notes: "Plano ambíguo B",
            createdAt: 1_700_200_020,
          },
        ],
      );

      const groups = await client.execute(
        "SELECT id, planned_workout_id, name, position FROM planned_workout_groups",
      );
      assert.deepEqual(groups.rows, [
        {
          id: 300,
          planned_workout_id: 200,
          name: "Peito",
          position: 0,
        },
      ]);

      await assert.rejects(
        client.execute({
          sql: `
            INSERT INTO planned_workouts
              (user_id, date, workout_id, notes)
            VALUES (?, ?, ?, ?)
          `,
          args: [1, 1_700_300_000, 100, "Ligação duplicada"],
        }),
      );

      await client.execute("DELETE FROM workout_templates WHERE id = 10");
      const retainedPlans = await client.execute(
        "SELECT count(*) AS count FROM planned_workouts WHERE template_id IS NULL",
      );
      assert.equal(Number(retainedPlans.rows[0]?.count), 3);

      const sequence = await client.execute(
        "SELECT seq FROM sqlite_sequence WHERE name = 'planned_workouts'",
      );
      assert.equal(Number(sequence.rows[0]?.seq), 999);
      const nextPlan = await client.execute({
        sql: "INSERT INTO planned_workouts (user_id, date, notes) VALUES (?, ?, ?)",
        args: [1, 1_701_000_000, "Plano após migração"],
      });
      assert.equal(Number(nextPlan.lastInsertRowid), 1000);
      assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    } finally {
      client.close();
    }
  });
});

test("uma segunda execução é idempotente", async () => {
  await withTemporaryDatabase(async ({ url }) => {
    await migrateDatabase({ url, migrationsFolder: MIGRATIONS_FOLDER });
    const second = await migrateDatabase({
      url,
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    assert.deepEqual(second, {
      initialState: "tracked",
      migrationsApplied: 0,
      ledgerImported: false,
    });

    const client = createClient({ url });
    try {
      const ledger = await readLedger(client);
      assert.equal(ledger.rows.length, 2);
      assert.equal(
        new Set(ledger.rows.map((row) => Number(row.created_at))).size,
        2,
      );
    } finally {
      client.close();
    }
  });
});

test("importa atomicamente o ledger de um schema atual conhecido", async () => {
  await withTemporaryDatabase(async ({ url }) => {
    const setup = createClient({ url });
    try {
      await createCurrentDatabaseWithoutLedger(setup);
      assert.equal(
        (
          await setup.execute(
            "SELECT count(*) AS count FROM sqlite_schema WHERE name = '__drizzle_migrations'",
          )
        ).rows[0]?.count,
        0,
      );
    } finally {
      setup.close();
    }

    const result = await migrateDatabase({
      url,
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    assert.deepEqual(result, {
      initialState: "current-without-ledger",
      migrationsApplied: 0,
      ledgerImported: true,
    });

    const client = createClient({ url });
    try {
      assert.equal((await readLedger(client)).rows.length, 2);
    } finally {
      client.close();
    }
  });
});

test("recusa um schema parcial sem fazer qualquer escrita e o CLI sai com erro", async () => {
  await withTemporaryDatabase(async ({ url }) => {
    const setup = createClient({ url });
    try {
      await setup.execute("CREATE TABLE users (id integer PRIMARY KEY)");
    } finally {
      setup.close();
    }

    await assert.rejects(
      migrateDatabase({ url, migrationsFolder: MIGRATIONS_FOLDER }),
      /Schema desconhecido ou parcial/,
    );

    const check = createClient({ url });
    try {
      const objects = await check.execute(`
        SELECT name FROM sqlite_schema
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      assert.deepEqual(objects.rows.map((row) => row.name), ["users"]);
    } finally {
      check.close();
    }

    const childEnvironment = { ...process.env };
    // A subprocess spawned by `node --test` must not inherit the private test
    // runner channel, otherwise Node treats the CLI as another test worker.
    delete childEnvironment.NODE_TEST_CONTEXT;
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/migrate-database.ts"],
      {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
        env: {
          ...childEnvironment,
          NODE_ENV: "test",
          DATABASE_URL: url,
          DATABASE_AUTH_TOKEN: "",
          VERCEL: "",
          VERCEL_ENV: "",
        },
        timeout: 20_000,
      },
    );
    assert.equal(child.status, 1, child.stderr);
  });
});

test("recusa hashes ou timestamps adulterados no ledger", async () => {
  await withTemporaryDatabase(async ({ url }) => {
    await migrateDatabase({ url, migrationsFolder: MIGRATIONS_FOLDER });
    const migrations = readMigrationFiles({
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    const first = migrations[0];
    assert.ok(first);

    const client = createClient({ url });
    try {
      await client.execute({
        sql: "UPDATE __drizzle_migrations SET hash = ? WHERE created_at = ?",
        args: ["0".repeat(64), first.folderMillis],
      });
    } finally {
      client.close();
    }
    await assert.rejects(
      migrateDatabase({ url, migrationsFolder: MIGRATIONS_FOLDER }),
      /ledger diverge/,
    );

    const repair = createClient({ url });
    try {
      await repair.execute({
        sql: `
          UPDATE __drizzle_migrations
          SET hash = ?, created_at = ?
          WHERE created_at = ?
        `,
        args: [first.hash, first.folderMillis + 1, first.folderMillis],
      });
    } finally {
      repair.close();
    }
    await assert.rejects(
      migrateDatabase({ url, migrationsFolder: MIGRATIONS_FOLDER }),
      /ledger diverge/,
    );
  });
});

test("exige token antes de tentar contactar uma base libSQL remota", async () => {
  await assert.rejects(
    migrateDatabase({
      url: "libsql://example.invalid",
      migrationsFolder: MIGRATIONS_FOLDER,
    }),
    /DATABASE_AUTH_TOKEN é obrigatório/,
  );
});
