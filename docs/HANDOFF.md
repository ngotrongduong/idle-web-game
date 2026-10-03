# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M0 — Nền móng.

## Completed in this branch
- M0.1 monorepo workspace paths: `apps/*`, `packages/*`, `tools/*`.
- `apps/web`: React 19 + Vite mobile-first placeholder shell.
- `apps/server`: Fastify server with `GET /health`.
- Shared packages: `game-core`, `game-data`, `api-contract`, `i18n`.
- Root scripts: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm build`.
- M0.2 partial: GitHub Actions CI workflow added.
- M0.3 implementation: CSV parser, CSV → JSON build, Zod schemas, unique-ID and cross-reference validation, starter original data.
- M0.4 implementation: seeded RNG, integer/BPS stat and damage math, deterministic `simulateWave`, compact FNV-1a replay hash, golden test, source guard against ambient random calls.
- M0.5 implementation: reusable enhancement model with safe +5 floor and +5% pity; battle Monte Carlo across four original sample encounters; enhancement Monte Carlo with mean/P50/P90/P99; root CLI commands `pnpm sim:battle` and `pnpm sim:upgrade`.

## Verification status
Runtime verification is still pending because the current `pnpm-lock.yaml` only contains the pre-existing inspect-tool dependencies. The GitHub connector commits did not trigger an Actions run, and the current execution container cannot reach github.com to install packages. Do not mark M0.1–M0.5 fully verified until a real checkout runs the commands below.

## Required verification
1. Run `pnpm install --no-frozen-lockfile` once and commit the refreshed `pnpm-lock.yaml`.
2. Run `pnpm typecheck`.
3. Run `pnpm test`.
4. Run `pnpm build`.
5. Run `pnpm sim:battle -- --runs 10000`.
6. Run `pnpm sim:upgrade -- --runs 20000 --target 10`; expected mean should be near the design target of ~49 attempts.
7. After the lockfile is committed, change CI install to `pnpm install --frozen-lockfile`.

## Next implementation work
1. Finish M0.2: ESLint + Prettier; enforce deterministic rules in lint; keep CI green.
2. Expand M0.3 data to the first complete MVP config slice (4 families T1–T3, 4 dungeons, enemies, ~30 items, ~15 materials).
3. Expand M0.4 battle engine with MP/ULT, targeting roles, counters and battle rewards while preserving golden hashes.
4. M0.6: Fastify command pipeline, guest session, Drizzle schema/migrations, player locking and idempotency.
5. M0.7: local Docker Compose + staging deployment files after server persistence exists.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
