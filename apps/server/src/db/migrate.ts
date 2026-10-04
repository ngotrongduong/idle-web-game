import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run database migrations");
}

const here = dirname(fileURLToPath(import.meta.url));
const migrationDir = resolve(here, "../../drizzle");
const migrationFiles = (await readdir(migrationDir))
  .filter((filename) => filename.endsWith(".sql"))
  .sort();

const pool = new Pool({ connectionString: databaseUrl });

try {
  for (const filename of migrationFiles) {
    const sql = await readFile(resolve(migrationDir, filename), "utf8");
    await pool.query(sql);
    console.log(`database migration applied: ${filename}`);
  }
} finally {
  await pool.end();
}
