---
name: local-ci
description: Run the same checks as GitHub Actions locally with scripts/ci-local.sh and fix its environment preconditions (PostgreSQL, busy ports, browser). Use before pushing, when CI is red, or when asked to verify the branch.
argument-hint: "[--quick | --no-e2e | --install]"
---

# Local CI

`scripts/ci-local.sh $ARGUMENTS` mirrors `.github/workflows/ci.yml`:

| Step | Full | `--quick` |
|---|---|---|
| migrations ×2 (must be idempotent) | ✓ | if PostgreSQL is reachable |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` | ✓ | ✓ |
| `sim:economy` report | ✓ | |
| Chromium golden battle (v1 + v2 hashes) | ✓ | |
| browser E2Es: dungeon, promotion, equipment, auto-sell | ✓ (skip with `--no-e2e`) | |
| `pnpm build`, `docker compose config` | ✓ | |

Use `--quick` while iterating and the full run before a push. A green full run takes about a minute;
logs of background servers go to `$TMPDIR/guildhall-ci/` (default `/tmp/guildhall-ci/`).

## Preconditions and fixes

- **PostgreSQL** (`DATABASE_URL`, default
  `postgresql://postgres:postgres@127.0.0.1:5432/guildhall_test`):
  - Debian/Ubuntu container with a local cluster: `pg_ctlcluster 16 main start`, then create the
    role/database if missing:
    `su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres'\""` and
    `su postgres -c "createdb guildhall_test"`.
  - With Docker: `docker run -d --name guildhall-test-db -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=guildhall_test postgres:16-alpine`.
- **Busy ports** 3001/5173/5174: find the holder with `ss -ltnp | grep -E ':(3001|5173|5174)'`.
  Leftover E2E servers can be stopped with `pkill -f '[t]sx src/index.ts'` and
  `pkill -f '[v]ite --host 127.0.0.1'` (the brackets stop pkill from matching its own shell).
- **Browser**: the script defaults to `GUILDHALL_BROWSER=chromium` (Playwright's bundled Chromium;
  in Claude Code cloud containers it lives under `PLAYWRIGHT_BROWSERS_PATH`). Never run
  `playwright install` there. CI uses the Chrome channel.
- **Dependencies**: `--install` runs `pnpm install --frozen-lockfile`.

## Reading failures

- `format check` → `pnpm format`, then re-run.
- `test` in `packages/game-data` saying the generated config is out of date →
  `pnpm --filter @idle/game-data build` and commit `generated/config.json`.
- Golden hash mismatch → a determinism or v1/v2 rules regression. Never update a golden to make it
  pass; find the change that moved it.
- E2E "control stayed disabled" or a wrong player after reload → a UI race in the E2E script or the
  app; read the step that waited and the server log tail printed by the script.
- After the run, `git status --short` must show nothing new: a rewritten file means something is
  out of sync.
