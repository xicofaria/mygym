import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  createClient,
  type Client,
  type InStatement,
  type Row,
  type Value,
} from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  readMigrationFiles,
  type MigrationMeta,
} from "drizzle-orm/migrator";

const MIGRATIONS_TABLE = "__drizzle_migrations";
const DEFAULT_MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../drizzle", import.meta.url),
);

type ColumnDescription = {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKeyPosition: number;
  hidden: number;
};

type ForeignKeyDescription = {
  id: number;
  sequence: number;
  targetTable: string;
  fromColumn: string;
  toColumn: string;
  onUpdate: string;
  onDelete: string;
  match: string;
};

type IndexColumnDescription = {
  sequence: number;
  cid: number;
  name: string | null;
  descending: boolean;
  collation: string | null;
  key: boolean;
};

type IndexDescription = {
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
  columns: IndexColumnDescription[];
};

type TableDescription = {
  name: string;
  columnCount: number;
  withoutRowId: boolean;
  strict: boolean;
  columns: ColumnDescription[];
  foreignKeys: ForeignKeyDescription[];
  indexes: IndexDescription[];
};

type SchemaDescription = {
  tables: TableDescription[];
  viewsAndTriggers: Array<{
    type: string;
    name: string;
    tableName: string;
    sql: string | null;
  }>;
};

type LedgerEntry = {
  hash: string;
  createdAt: number;
};

type LedgerState = {
  exists: boolean;
  entries: LedgerEntry[];
};

type LegacyDataSnapshot = {
  plans: Array<{
    id: number;
    userId: number;
    date: number;
    templateId: number | null;
    notes: string | null;
    createdAt: number;
  }>;
  groups: Array<{
    id: number;
    plannedWorkoutId: number;
    name: string;
    position: number;
  }>;
  sequence: number | null;
};

export type MigrateDatabaseOptions = {
  url: string;
  authToken?: string;
  migrationsFolder?: string;
};

export type MigrateDatabaseResult = {
  initialState:
    | "empty"
    | "legacy-without-ledger"
    | "tracked"
    | "current-without-ledger";
  migrationsApplied: number;
  ledgerImported: boolean;
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function getValue(row: Row, column: string): Value {
  const value = row[column];
  if (value === undefined) {
    throw new Error(`A consulta de introspeção não devolveu a coluna ${column}.`);
  }
  return value;
}

function asString(value: Value, description: string): string {
  if (typeof value !== "string") {
    throw new Error(`${description} não é texto.`);
  }
  return value;
}

function asNullableString(value: Value, description: string): string | null {
  if (value === null) return null;
  return asString(value, description);
}

function asNumber(value: Value, description: string): number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${description} não é um inteiro seguro.`);
    }
    return value;
  }

  if (typeof value === "bigint") {
    const converted = Number(value);
    if (!Number.isSafeInteger(converted)) {
      throw new Error(`${description} não é um inteiro seguro.`);
    }
    return converted;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const converted = Number(value);
    if (Number.isSafeInteger(converted)) return converted;
  }

  throw new Error(`${description} não é um inteiro.`);
}

function asNullableNumber(value: Value, description: string): number | null {
  if (value === null) return null;
  return asNumber(value, description);
}

function asBoolean(value: Value, description: string): boolean {
  const number = asNumber(value, description);
  if (number !== 0 && number !== 1) {
    throw new Error(`${description} não é um booleano SQLite.`);
  }
  return number === 1;
}

function normalizedSql(value: Value): string | null {
  const sql = asNullableString(value, "SQL de um objeto do schema");
  return sql?.replace(/\s+/g, " ").trim() ?? null;
}

async function describeSchema(client: Client): Promise<SchemaDescription> {
  const objectsResult = await client.execute({
    sql: `
      SELECT type, name, tbl_name, sql
      FROM sqlite_schema
      WHERE name NOT LIKE 'sqlite_%'
        AND name <> ?
        AND tbl_name <> ?
      ORDER BY type, name
    `,
    args: [MIGRATIONS_TABLE, MIGRATIONS_TABLE],
  });

  const tableNames = objectsResult.rows
    .filter((row) => getValue(row, "type") === "table")
    .map((row) => asString(getValue(row, "name"), "Nome de tabela"))
    .sort();

  const tableListResult = await client.execute("PRAGMA table_list");
  const tableMetadata = new Map(
    tableListResult.rows.map((row) => [
      asString(getValue(row, "name"), "Nome em PRAGMA table_list"),
      {
        columnCount: asNumber(
          getValue(row, "ncol"),
          "Número de colunas da tabela",
        ),
        withoutRowId: asBoolean(
          getValue(row, "wr"),
          "Indicador WITHOUT ROWID",
        ),
        strict: asBoolean(getValue(row, "strict"), "Indicador STRICT"),
      },
    ]),
  );

  const tablePragmas = tableNames.flatMap((tableName) => {
    const quoted = quoteIdentifier(tableName);
    return [
      `PRAGMA table_xinfo(${quoted})`,
      `PRAGMA foreign_key_list(${quoted})`,
      `PRAGMA index_list(${quoted})`,
    ];
  });
  const tableResults =
    tablePragmas.length > 0
      ? await client.batch(tablePragmas, "read")
      : [];

  const rawTables = tableNames.map((name, tableIndex) => {
    const metadata = tableMetadata.get(name);
    if (!metadata) {
      throw new Error(`PRAGMA table_list não devolveu a tabela ${name}.`);
    }

    const columnsResult = tableResults[tableIndex * 3];
    const foreignKeysResult = tableResults[tableIndex * 3 + 1];
    const indexesResult = tableResults[tableIndex * 3 + 2];
    if (!columnsResult || !foreignKeysResult || !indexesResult) {
      throw new Error(`Introspeção incompleta da tabela ${name}.`);
    }

    const columns: ColumnDescription[] = columnsResult.rows.map((row) => ({
      cid: asNumber(getValue(row, "cid"), "CID da coluna"),
      name: asString(getValue(row, "name"), "Nome da coluna"),
      type: asString(getValue(row, "type"), "Tipo da coluna").toUpperCase(),
      notNull: asBoolean(getValue(row, "notnull"), "Indicador NOT NULL"),
      defaultValue: asNullableString(
        getValue(row, "dflt_value"),
        "Valor predefinido da coluna",
      ),
      primaryKeyPosition: asNumber(
        getValue(row, "pk"),
        "Posição na chave primária",
      ),
      hidden: asNumber(getValue(row, "hidden"), "Indicador de coluna oculta"),
    }));

    const foreignKeys: ForeignKeyDescription[] = foreignKeysResult.rows
      .map((row) => ({
        id: asNumber(getValue(row, "id"), "ID da chave estrangeira"),
        sequence: asNumber(
          getValue(row, "seq"),
          "Sequência da chave estrangeira",
        ),
        targetTable: asString(
          getValue(row, "table"),
          "Tabela da chave estrangeira",
        ),
        fromColumn: asString(
          getValue(row, "from"),
          "Coluna de origem da chave estrangeira",
        ),
        toColumn: asString(
          getValue(row, "to"),
          "Coluna de destino da chave estrangeira",
        ),
        onUpdate: asString(
          getValue(row, "on_update"),
          "Ação ON UPDATE",
        ).toUpperCase(),
        onDelete: asString(
          getValue(row, "on_delete"),
          "Ação ON DELETE",
        ).toUpperCase(),
        match: asString(
          getValue(row, "match"),
          "Cláusula MATCH",
        ).toUpperCase(),
      }))
      .sort(
        (left, right) =>
          left.id - right.id || left.sequence - right.sequence,
      );

    const rawIndexes = indexesResult.rows
      .map((row) => ({
        name: asString(getValue(row, "name"), "Nome do índice"),
        unique: asBoolean(getValue(row, "unique"), "Indicador UNIQUE"),
        origin: asString(getValue(row, "origin"), "Origem do índice"),
        partial: asBoolean(getValue(row, "partial"), "Indicador de índice parcial"),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return { name, metadata, columns, foreignKeys, rawIndexes };
  });

  const allIndexes = rawTables.flatMap((table) => table.rawIndexes);
  const indexResults =
    allIndexes.length > 0
      ? await client.batch(
          allIndexes.map(
            (index) => `PRAGMA index_xinfo(${quoteIdentifier(index.name)})`,
          ),
          "read",
        )
      : [];

  let indexResultPosition = 0;
  const tables: TableDescription[] = rawTables.map((table) => ({
    name: table.name,
    ...table.metadata,
    columns: table.columns,
    foreignKeys: table.foreignKeys,
    indexes: table.rawIndexes.map((index) => {
      const result = indexResults[indexResultPosition++];
      if (!result) {
        throw new Error(`Introspeção incompleta do índice ${index.name}.`);
      }
      return {
        ...index,
        columns: result.rows
          .map((row) => ({
            sequence: asNumber(
              getValue(row, "seqno"),
              "Sequência da coluna do índice",
            ),
            cid: asNumber(getValue(row, "cid"), "CID da coluna do índice"),
            name: asNullableString(
              getValue(row, "name"),
              "Nome da coluna do índice",
            ),
            descending: asBoolean(
              getValue(row, "desc"),
              "Direção da coluna do índice",
            ),
            collation: asNullableString(
              getValue(row, "coll"),
              "Collation da coluna do índice",
            ),
            key: asBoolean(
              getValue(row, "key"),
              "Indicador de coluna-chave do índice",
            ),
          }))
          .sort((left, right) => left.sequence - right.sequence),
      };
    }),
  }));

  const viewsAndTriggers = objectsResult.rows
    .filter((row) => {
      const type = getValue(row, "type");
      return type === "view" || type === "trigger";
    })
    .map((row) => ({
      type: asString(getValue(row, "type"), "Tipo do objeto de schema"),
      name: asString(getValue(row, "name"), "Nome do objeto de schema"),
      tableName: asString(
        getValue(row, "tbl_name"),
        "Tabela do objeto de schema",
      ),
      sql: normalizedSql(getValue(row, "sql")),
    }));

  return { tables, viewsAndTriggers };
}

function migrationStatements(migration: MigrationMeta): string[] {
  return migration.sql.map((statement) => statement.trim()).filter(Boolean);
}

function validateMigrationDefinitions(migrations: MigrationMeta[]): void {
  if (migrations.length < 2) {
    throw new Error(
      "São esperadas, pelo menos, a migração baseline e uma evolução versionada.",
    );
  }

  let previousTimestamp = -1;
  for (const [index, migration] of migrations.entries()) {
    if (
      !Number.isSafeInteger(migration.folderMillis) ||
      migration.folderMillis <= previousTimestamp
    ) {
      throw new Error(
        `O timestamp da migração ${index} não é um inteiro estritamente crescente.`,
      );
    }
    if (!/^[a-f0-9]{64}$/.test(migration.hash)) {
      throw new Error(`O hash da migração ${index} não é SHA-256 válido.`);
    }
    if (migrationStatements(migration).length === 0) {
      throw new Error(`A migração ${index} não contém instruções SQL.`);
    }
    previousTimestamp = migration.folderMillis;
  }
}

async function deriveKnownSchemas(
  migrations: MigrationMeta[],
): Promise<SchemaDescription[]> {
  const client = createClient({ url: "file::memory:" });
  const schemas: SchemaDescription[] = [];

  try {
    schemas.push(await describeSchema(client));
    for (const migration of migrations) {
      await client.migrate(migrationStatements(migration));
      schemas.push(await describeSchema(client));
    }
    return schemas;
  } finally {
    client.close();
  }
}

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.execute({
    sql: "SELECT 1 AS found FROM sqlite_schema WHERE type = 'table' AND name = ?",
    args: [tableName],
  });
  return result.rows.length === 1;
}

function assertLedgerTableShape(rows: Row[]): void {
  const actual = rows.map((row) => ({
    name: asString(getValue(row, "name"), "Nome da coluna do ledger"),
    type: asString(getValue(row, "type"), "Tipo da coluna do ledger").toUpperCase(),
    notNull: asBoolean(
      getValue(row, "notnull"),
      "Indicador NOT NULL do ledger",
    ),
    primaryKeyPosition: asNumber(
      getValue(row, "pk"),
      "Posição de chave primária do ledger",
    ),
  }));
  const expected = [
    { name: "id", type: "SERIAL", notNull: false, primaryKeyPosition: 1 },
    { name: "hash", type: "TEXT", notNull: true, primaryKeyPosition: 0 },
    {
      name: "created_at",
      type: "NUMERIC",
      notNull: false,
      primaryKeyPosition: 0,
    },
  ];

  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`A estrutura de ${MIGRATIONS_TABLE} não é a esperada.`);
  }
}

async function readAndAuditLedger(
  client: Client,
  migrations: MigrationMeta[],
): Promise<LedgerState> {
  const exists = await tableExists(client, MIGRATIONS_TABLE);
  if (!exists) return { exists: false, entries: [] };

  const columns = await client.execute(
    `PRAGMA table_xinfo(${quoteIdentifier(MIGRATIONS_TABLE)})`,
  );
  assertLedgerTableShape(columns.rows);

  const ledger = await client.execute(
    `SELECT hash, created_at FROM ${quoteIdentifier(MIGRATIONS_TABLE)} ORDER BY created_at, rowid`,
  );
  const entries = ledger.rows.map((row, index) => ({
    hash: asString(getValue(row, "hash"), `Hash do ledger na posição ${index}`),
    createdAt: asNumber(
      getValue(row, "created_at"),
      `Timestamp do ledger na posição ${index}`,
    ),
  }));

  if (entries.length > migrations.length) {
    throw new Error("O ledger contém migrações que não existem neste código.");
  }

  for (const [index, entry] of entries.entries()) {
    const expected = migrations[index];
    if (
      !expected ||
      entry.createdAt !== expected.folderMillis ||
      entry.hash !== expected.hash
    ) {
      throw new Error(
        `O ledger diverge da migração local na posição ${index}; a execução foi recusada.`,
      );
    }
  }

  return { exists: true, entries };
}

async function assertNoForeignKeyViolations(
  client: Client,
  phase: "antes" | "depois",
): Promise<void> {
  const result = await client.execute("PRAGMA foreign_key_check");
  if (result.rows.length > 0) {
    throw new Error(
      `Foram encontradas ${result.rows.length} violações de chaves estrangeiras ${phase} da migração.`,
    );
  }
}

async function readLegacyDataSnapshot(
  client: Client,
): Promise<LegacyDataSnapshot> {
  const [plansResult, groupsResult, sequenceResult] = await client.batch(
    [
      `
        SELECT id, user_id, date, template_id, notes, created_at
        FROM planned_workouts
        ORDER BY id
      `,
      `
        SELECT id, planned_workout_id, name, position
        FROM planned_workout_groups
        ORDER BY id
      `,
      `SELECT seq FROM sqlite_sequence WHERE name = 'planned_workouts'`,
    ],
    "read",
  );
  if (!plansResult || !groupsResult || !sequenceResult) {
    throw new Error("Não foi possível criar o snapshot dos planos legados.");
  }

  return {
    plans: plansResult.rows.map((row) => ({
      id: asNumber(getValue(row, "id"), "ID do plano legado"),
      userId: asNumber(
        getValue(row, "user_id"),
        "Utilizador do plano legado",
      ),
      date: asNumber(getValue(row, "date"), "Data do plano legado"),
      templateId: asNullableNumber(
        getValue(row, "template_id"),
        "Template do plano legado",
      ),
      notes: asNullableString(getValue(row, "notes"), "Notas do plano legado"),
      createdAt: asNumber(
        getValue(row, "created_at"),
        "Criação do plano legado",
      ),
    })),
    groups: groupsResult.rows.map((row) => ({
      id: asNumber(getValue(row, "id"), "ID do grupo de plano legado"),
      plannedWorkoutId: asNumber(
        getValue(row, "planned_workout_id"),
        "Plano do grupo legado",
      ),
      name: asString(getValue(row, "name"), "Nome do grupo legado"),
      position: asNumber(
        getValue(row, "position"),
        "Posição do grupo legado",
      ),
    })),
    sequence:
      sequenceResult.rows.length === 0
        ? null
        : asNumber(
            getValue(sequenceResult.rows[0]!, "seq"),
            "Sequência dos planos legados",
          ),
  };
}

async function assertLegacyDataPreserved(
  client: Client,
  before: LegacyDataSnapshot,
): Promise<void> {
  const after = await readLegacyDataSnapshot(client);
  const plansById = new Map(after.plans.map((plan) => [plan.id, plan]));
  const groupsById = new Map(after.groups.map((group) => [group.id, group]));

  if (after.plans.length < before.plans.length) {
    throw new Error("A migração removeu planos legados.");
  }
  for (const plan of before.plans) {
    if (!isDeepStrictEqual(plansById.get(plan.id), plan)) {
      throw new Error(`O plano legado ${plan.id} não foi preservado.`);
    }
  }

  if (after.groups.length < before.groups.length) {
    throw new Error("A migração removeu grupos de planos legados.");
  }
  for (const group of before.groups) {
    if (!isDeepStrictEqual(groupsById.get(group.id), group)) {
      throw new Error(`O grupo de plano legado ${group.id} não foi preservado.`);
    }
  }

  if (
    before.sequence !== null &&
    (after.sequence === null || after.sequence < before.sequence)
  ) {
    throw new Error("A sequência AUTOINCREMENT de planned_workouts regrediu.");
  }
}

function findMatchingSchemaPositions(
  actual: SchemaDescription,
  knownSchemas: SchemaDescription[],
): number[] {
  const positions: number[] = [];
  for (const [index, known] of knownSchemas.entries()) {
    if (isDeepStrictEqual(actual, known)) positions.push(index);
  }
  return positions;
}

function assertCurrentPlannedWorkoutsSchema(schema: SchemaDescription): void {
  const plannedWorkouts = schema.tables.find(
    (table) => table.name === "planned_workouts",
  );
  if (!plannedWorkouts) {
    throw new Error("A tabela planned_workouts não existe após a migração.");
  }

  const expectedColumns = [
    "id",
    "user_id",
    "date",
    "template_id",
    "workout_id",
    "routine_date",
    "notes",
    "created_at",
  ];
  if (
    !isDeepStrictEqual(
      plannedWorkouts.columns.map((column) => column.name),
      expectedColumns,
    )
  ) {
    throw new Error("As colunas de planned_workouts não são as esperadas.");
  }

  const foreignKey = (
    fromColumn: string,
    targetTable: string,
    onDelete: string,
  ) =>
    plannedWorkouts.foreignKeys.some(
      (candidate) =>
        candidate.fromColumn === fromColumn &&
        candidate.targetTable === targetTable &&
        candidate.toColumn === "id" &&
        candidate.onDelete === onDelete &&
        candidate.onUpdate === "NO ACTION",
    );
  if (
    plannedWorkouts.foreignKeys.length !== 3 ||
    !foreignKey("user_id", "users", "CASCADE") ||
    !foreignKey("template_id", "workout_templates", "SET NULL") ||
    !foreignKey("workout_id", "workouts", "SET NULL")
  ) {
    throw new Error("As chaves estrangeiras de planned_workouts não são as esperadas.");
  }

  const uniqueIndex = (name: string, columns: string[]) => {
    const index = plannedWorkouts.indexes.find(
      (candidate) => candidate.name === name,
    );
    return (
      index?.unique === true &&
      isDeepStrictEqual(
        index.columns
          .filter((column) => column.key)
          .map((column) => column.name),
        columns,
      )
    );
  };
  if (
    !uniqueIndex("planned_workouts_workout_id_unique", ["workout_id"]) ||
    !uniqueIndex("planned_workouts_user_routine_date_unique", [
      "user_id",
      "routine_date",
    ])
  ) {
    throw new Error("Os índices únicos de planned_workouts não são os esperados.");
  }
}

async function importCurrentLedger(
  client: Client,
  migrations: MigrationMeta[],
): Promise<void> {
  const statements: InStatement[] = [
    `
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(MIGRATIONS_TABLE)} (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      )
    `,
    ...migrations.map((migration) => ({
      sql: `
        INSERT INTO ${quoteIdentifier(MIGRATIONS_TABLE)} (hash, created_at)
        SELECT ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM ${quoteIdentifier(MIGRATIONS_TABLE)}
          WHERE created_at = ?
        )
      `,
      args: [migration.hash, migration.folderMillis, migration.folderMillis],
    })),
  ];
  await client.migrate(statements);
}

function assertSameMigrationDefinitions(
  before: MigrationMeta[],
  after: MigrationMeta[],
): void {
  const selectIdentity = (migration: MigrationMeta) => ({
    hash: migration.hash,
    createdAt: migration.folderMillis,
  });
  if (
    !isDeepStrictEqual(before.map(selectIdentity), after.map(selectIdentity))
  ) {
    throw new Error("Os ficheiros de migração mudaram durante a execução.");
  }
}

function validateDatabaseUrl(url: string, authToken?: string): void {
  if (!url) throw new Error("DATABASE_URL é obrigatório.");

  let protocol: string;
  try {
    protocol = new URL(url).protocol.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL não é um URL válido.");
  }

  if (protocol !== "file:" && !authToken?.trim()) {
    throw new Error(
      "DATABASE_AUTH_TOKEN é obrigatório para uma base de dados libSQL remota.",
    );
  }
}

export async function migrateDatabase({
  url,
  authToken,
  migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
}: MigrateDatabaseOptions): Promise<MigrateDatabaseResult> {
  validateDatabaseUrl(url, authToken);
  const resolvedMigrationsFolder = resolve(migrationsFolder);
  const migrations = readMigrationFiles({
    migrationsFolder: resolvedMigrationsFolder,
  });
  validateMigrationDefinitions(migrations);
  const knownSchemas = await deriveKnownSchemas(migrations);

  const client = createClient(
    authToken?.trim() ? { url, authToken } : { url },
  );
  let initialState: MigrateDatabaseResult["initialState"] = "tracked";
  let ledgerImported = false;
  let migrationsApplied = 0;

  try {
    const schemaBefore = await describeSchema(client);
    const ledgerBefore = await readAndAuditLedger(client, migrations);
    const matchingPositions = findMatchingSchemaPositions(
      schemaBefore,
      knownSchemas,
    );
    const appliedBefore = ledgerBefore.entries.length;

    if (appliedBefore > 0) {
      if (!matchingPositions.includes(appliedBefore)) {
        throw new Error(
          "O schema não corresponde à posição registada no ledger de migrações.",
        );
      }
      initialState = "tracked";
    } else if (matchingPositions.includes(0)) {
      initialState = "empty";
    } else if (matchingPositions.includes(1)) {
      initialState = "legacy-without-ledger";
    } else if (
      matchingPositions.length === 1 &&
      matchingPositions[0] === migrations.length
    ) {
      initialState = "current-without-ledger";
    } else {
      const tables = schemaBefore.tables.map((table) => table.name).join(", ");
      throw new Error(
        `Schema desconhecido ou parcial; tabelas encontradas: ${tables || "nenhuma"}.`,
      );
    }

    await assertNoForeignKeyViolations(client, "antes");
    const legacySnapshot = matchingPositions.includes(1)
      ? await readLegacyDataSnapshot(client)
      : null;

    if (initialState === "current-without-ledger") {
      await importCurrentLedger(client, migrations);
      ledgerImported = true;
      await readAndAuditLedger(client, migrations);
    }

    const appliedImmediatelyBeforeMigration = ledgerImported
      ? migrations.length
      : appliedBefore;
    await migrate(drizzle(client), {
      migrationsFolder: resolvedMigrationsFolder,
    });
    migrationsApplied = migrations.length - appliedImmediatelyBeforeMigration;

    const migrationsAfter = readMigrationFiles({
      migrationsFolder: resolvedMigrationsFolder,
    });
    assertSameMigrationDefinitions(migrations, migrationsAfter);

    const schemaAfter = await describeSchema(client);
    const expectedCurrent = knownSchemas[migrations.length];
    if (!expectedCurrent || !isDeepStrictEqual(schemaAfter, expectedCurrent)) {
      throw new Error("O schema final não corresponde às migrações versionadas.");
    }
    assertCurrentPlannedWorkoutsSchema(schemaAfter);
    if (legacySnapshot) {
      await assertLegacyDataPreserved(client, legacySnapshot);
    }
    await assertNoForeignKeyViolations(client, "depois");

    const ledgerAfter = await readAndAuditLedger(client, migrations);
    if (ledgerAfter.entries.length !== migrations.length) {
      throw new Error("O ledger não contém todas as migrações após a execução.");
    }

    return { initialState, migrationsApplied, ledgerImported };
  } finally {
    client.close();
  }
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const result = await migrateDatabase({
    url: process.env.DATABASE_URL ?? "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const suffix = result.ledgerImported
    ? " Ledger existente importado com segurança."
    : "";
  console.log(
    `Migração concluída: ${result.migrationsApplied} migração(ões) aplicada(s).${suffix}`,
  );
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Migração da base de dados falhou: ${message}`);
    process.exitCode = 1;
  });
}
