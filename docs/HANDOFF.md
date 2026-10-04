# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M0 — Nền móng.

## Verified status
- GitHub Actions CI run #59 passed on commit `144037725fc50b32a38b80953f1c119db2fa827d`.
- Frozen lockfile install, typecheck, tests and build are verified for the current gameplay and async persistence-seam changes through that commit.
- Keep PR #2 draft while M0 work continues; do not merge partial DB/staging work.

## Completed in this branch
- M0.1 monorepo workspace paths: `apps/*`, `packages/*`, `tools/*`.
- `apps/web`: React 19 + Vite mobile-first placeholder shell.
- `apps/server`: Fastify server foundation.
- M0.2 partial: GitHub Actions CI with frozen lockfile, typecheck, test and build.
- M0.3: CSV → JSON pipeline, Zod validation and cross-reference checks; original MVP slice includes 4 class families, 24 T1–T3 classes with explicit targeting/ULT metadata, 4 dungeons, 16 enemies, 15 materials and 30 craftable items.
- M0.4: seeded RNG, integer/BPS combat math, deterministic `simulateWave`, replay hash and golden test; MP/ULT supports deterministic damage or healing, role-aware targeting and class-family counters while preserving the legacy golden hash when optional features are unused.
- M0.5: enhancement model with +5 safety floor and pity; battle/enhancement Monte Carlo tools. Battle scenarios now derive progression teams, dungeon waves and gold/EXP rewards from validated game-data instead of hard-coded encounters.
- M0.6a: guest session + HttpOnly cookie, intent-only `/api/v1/cmd`, expected-version checks, per-player async lock, idempotent `cmdId`, and first `upgrade_hall` command.
- M0.6b implementation: Drizzle schema + PostgreSQL migration + `PostgresGameStore`; hashed sessions persist with expiry, command outcomes have a 24h retention window, and `withPlayerLock` uses a real transaction with `SELECT ... FOR UPDATE`. Server selects PostgreSQL via `DATABASE_URL` and falls back to in-memory locally.

## Next implementation work
1. Finish M0.2 with ESLint + Prettier once their dependencies can be added together with a regenerated frozen lockfile.
2. Expand M0.3 schema with class families/classes and enemy definitions, keeping content original.
3. Verify M0.6b in CI against the PostgreSQL service and fix any migration/type/transaction issues.
4. Add named skill IDs/effects beyond the generic damage/heal ULT model.
5. M0.7: Docker Compose + Caddy + staging deployment now that DB persistence exists.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
