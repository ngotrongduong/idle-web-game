# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M0 — Nền móng.

## Completed in this branch
- M0.1 monorepo workspace paths: `apps/*`, `packages/*`, `tools/*`.
- `apps/web`: React 19 + Vite mobile-first placeholder shell.
- Root scripts: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm build`.
- M0.2 partial: GitHub Actions CI workflow added.
- M0.3 implementation: CSV parser, CSV → JSON build, Zod schemas, unique-ID and cross-reference validation, starter original data.
- M0.4 implementation: seeded RNG, integer/BPS stat and damage math, deterministic `simulateWave`, compact FNV-1a replay hash, golden test, source guard against ambient random calls.
- M0.5 implementation: reusable enhancement model with safe +5 floor and +5% pity; battle Monte Carlo across four original sample encounters; enhancement Monte Carlo with mean/P50/P90/P99.
- M0.6a implementation: guest session token + HttpOnly cookie, player state endpoint, intent-only `/api/v1/cmd`, expected-version conflict detection, per-player async lock, idempotent `cmdId` outcomes, and a real `upgrade_hall` command using shared economy rules. In-memory storage is intentionally temporary.

## Verification status
Runtime verification is still pending because the current `pnpm-lock.yaml` only contains the pre-existing inspect-tool dependencies. The GitHub connector commits did not trigger an Actions run, and the current execution container cannot reach github.com to install packages. Do not mark M0.1–M0.6a fully verified until a real checkout runs the commands below.

## Required verification
1. Run `pnpm install --no-frozen-lockfile` once and commit the refreshed `pnpm-lock.yaml`.
2. Run `pnpm typecheck`.
3. Run `pnpm test`.
4. Run `pnpm build`.
5. Run `pnpm sim:battle -- --runs 10000`.
6. Run `pnpm sim:upgrade -- --runs 20000 --target 10`; expected mean should be near ~49 attempts.
7. After the lockfile is committed, change CI install to `pnpm install --frozen-lockfile`.

## Next implementation work
1. Finish M0.2: ESLint + Prettier; enforce deterministic rules in lint; keep CI green.
2. M0.6b: replace the in-memory store with PostgreSQL + Drizzle migrations while preserving the command/store interface; persist hashed sessions and 24h idempotency records; implement a real DB transaction with player row locking.
3. Expand M0.3 data to the first complete MVP config slice (4 families T1–T3, 4 dungeons, enemies, ~30 items, ~15 materials).
4. Expand battle engine with MP/ULT, targeting roles, counters and rewards while preserving existing golden hashes or versioning the rules explicitly.
5. M0.7: Docker Compose + Caddy + staging deployment files after DB persistence exists.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
