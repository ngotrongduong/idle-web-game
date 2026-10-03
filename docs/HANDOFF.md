# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M0 — Nền móng.

## Verified status
- GitHub Actions CI run #55 passed on commit `03169a0b9ca4d563d74f5101fc758784d67b298f`.
- Frozen lockfile install, typecheck, tests and build are verified for the current gameplay/code changes through that commit.
- Keep PR #2 draft while M0 work continues; do not merge partial DB/staging work.

## Completed in this branch
- M0.1 monorepo workspace paths: `apps/*`, `packages/*`, `tools/*`.
- `apps/web`: React 19 + Vite mobile-first placeholder shell.
- `apps/server`: Fastify server foundation.
- M0.2 partial: GitHub Actions CI with frozen lockfile, typecheck, test and build.
- M0.3: CSV → JSON pipeline, Zod validation and cross-reference checks; original MVP slice includes 4 class families, 24 T1–T3 classes with explicit targeting/ULT metadata, 4 dungeons, 16 enemies, 15 materials and 30 craftable items.
- M0.4: seeded RNG, integer/BPS combat math, deterministic `simulateWave`, replay hash and golden test; MP/ULT supports deterministic damage or healing, role-aware targeting and class-family counters while preserving the legacy golden hash when optional features are unused.
- M0.5: enhancement model with +5 safety floor and pity; battle/enhancement Monte Carlo tools. Battle scenarios now derive progression teams, dungeon waves and gold/EXP rewards from validated game-data instead of hard-coded encounters.
- M0.6a: guest session + HttpOnly cookie, intent-only `/api/v1/cmd`, expected-version checks, per-player async lock, idempotent `cmdId`, and first `upgrade_hall` command. Server routes now depend on an async `GameStore` interface, so PostgreSQL can replace the in-memory store without rewriting command logic.

## Next implementation work
1. Finish M0.2 with ESLint + Prettier once their dependencies can be added together with a regenerated frozen lockfile.
2. Expand M0.3 schema with class families/classes and enemy definitions, keeping content original.
3. M0.6b: implement PostgreSQL + Drizzle behind the existing async `GameStore` interface; persist hashed sessions and 24h idempotency outcomes; use a real transaction with player row locking.
4. Expand battle engine with MP/ULT, targeting roles, counters and rewards; version rules when golden hashes change.
5. M0.7: Docker Compose + Caddy + staging deployment after DB persistence exists.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
