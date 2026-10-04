---
name: new-migration
description: Checklist for adding or changing persisted state — contract schema with defaults, Drizzle schema, an idempotent hand-written SQL migration (with a data_migrations marker for one-shot data fixes), both stores, and tests. Use whenever a column, table, JSON field or stored value changes.
argument-hint: "[short description of the persisted change]"
---

# Persisted state change: $ARGUMENTS

Migrations in `apps/server/drizzle/*.sql` are plain SQL files applied **in filename order on every
deploy** by `apps/server/src/db/migrate.ts` (there is no applied-migrations table). Every file must
therefore be safe to run again on a database that already has it.

## 1. Migration file
- Next number: `ls apps/server/drizzle | tail -1`, then `NNNN_m1_<topic>.sql`. Never edit a
  migration that has been pushed.
- Schema changes: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT ...`,
  `CREATE INDEX IF NOT EXISTS`, constraints inside `DO $$ BEGIN IF NOT EXISTS (...) THEN ... END IF; END $$;`.
- One-shot data fixes (remaps, backfills): guard with a marker row, as in `0011`/`0013`:

  ```sql
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM data_migrations WHERE id = 'NNNN_<what>') THEN
      UPDATE ...;
      INSERT INTO data_migrations (id) VALUES ('NNNN_<what>');
    END IF;
  END
  $$;
  ```

- Think about existing rows: what value do old players get, and does it keep their progress?

## 2. Code
- `packages/api-contract`: add the field to the zod schema (unknown keys are stripped). Persisted
  objects need `.default(...)` or `.nullable().default(null)` so old rows and old payloads parse.
  Add it to `CommandPatch` if commands return it.
- `apps/server/src/db/schema.ts`: Drizzle column matching the SQL type, nullability and default.
- `apps/server/src/db/postgres-store.ts`: read mapping, insert/update, `RETURNING` lists, and a
  stable `ORDER BY` on lists.
- `apps/server/src/store.ts` (InMemory): store and return deep copies (arrays and nested objects).
- Web types if the client reads it.

## 3. Tests and checks
- InMemory behaviour through the command tests, and the PostgreSQL round-trip in
  `apps/server/test/postgres-store.test.ts`.
- For a backfill or remap, a test (or a manual check recorded in the PR) that the second run is a
  no-op and that rows written before the migration end up correct.
- `pnpm --filter @idle/server db:migrate` twice on the CI database, then
  `pnpm --filter @idle/server test` and `pnpm typecheck`.
