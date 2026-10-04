import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run database migrations");
}

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  here,
  "../../drizzle/0000_m0_persistence.sql",
);
const sql = await readFile(migrationPath, "utf8");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(sql);
  console.log("database migration applied: 0000_m0_persistence.sql");
} finally {
  await pool.end();
}
