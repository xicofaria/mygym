/**
 * Successful production deployments apply verified, versioned migrations
 * after compilation and before the new build can become active.
 */
import { spawnSync } from "node:child_process";

if (
  process.env.VERCEL !== "1" ||
  process.env.VERCEL_ENV !== "production"
) {
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("libsql://")) {
  throw new Error(
    "DATABASE_URL de produção tem de ser um URL libsql:// antes de aplicar o schema.",
  );
}
if (!process.env.DATABASE_AUTH_TOKEN) {
  throw new Error(
    "DATABASE_AUTH_TOKEN é obrigatório para aplicar o schema de produção.",
  );
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["run", "db:migrate"], {
  env: process.env,
  stdio: ["ignore", "inherit", "inherit"],
});

if (result.error) {
  throw new Error("Não foi possível iniciar as migrações da base de dados.", {
    cause: result.error,
  });
}
if (result.signal) {
  throw new Error(`Migrações interrompidas por ${result.signal}.`);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
