import { rmSync } from "node:fs";
import { resolve } from "node:path";

const expectedUrl = "file:./e2e.db";
if (process.env.DATABASE_URL !== expectedUrl) {
  throw new Error(
    `Recusado: os E2E só podem preparar DATABASE_URL=${expectedUrl}.`,
  );
}

for (const name of ["e2e.db", "e2e.db-shm", "e2e.db-wal"]) {
  rmSync(resolve(process.cwd(), name), { force: true });
}
