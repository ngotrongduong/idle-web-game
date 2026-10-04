# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M1 — Core loop.

## Verified status
- GitHub Actions CI run #184 passed on commit `3e4fcbe7f6e49ba6165903c7e4dc3cde9e3ab82f`.
- The verified flow now includes M1.2B backend, Team & Dungeon UI, client-side replay hash checks, and a real Chromium E2E path: guest → Tavern refresh → recruit 3 heroes → save Team 1 → start a 6-wave dungeon → verify 6/6 client hashes match the persisted server hashes.
- Frozen install, PostgreSQL migrations, lint, Prettier check, typecheck, unit/integration tests, Chromium golden battle, build and Docker Compose validation are green.
- PostgreSQL integration tests cover session expiry, 24h idempotency retention/pruning, transaction rollback, row-lock serialization, Tavern persistence and recruited heroes.
- Temporary format-once workflows have been removed; CI is read-only again.
- Keep PR #2 draft while M1 continues. Do not merge unfinished M1.2 work.

## Completed in this branch
- M0.1 monorepo workspace paths: `apps/*`, `packages/*`, `tools/*`.
- M0.2 CI: frozen lockfile, ESLint, Prettier, typecheck, tests, Chromium deterministic golden check, build.
- M0.3 validated original game-data pipeline and MVP content slice.
- M0.4 deterministic seeded battle engine with MP/ULT, healing, targeting, counters and replay hashes.
- M0.5 battle, enhancement and gacha simulation tools.
- M0.6 Fastify + Drizzle/PostgreSQL persistence, guest auth, server-authoritative `/cmd`, version checks, idempotency and real row locks.
- M0.7 Docker Compose + Caddy/server/web Dockerfiles and compose validation. Real VPS/domain deployment remains external/pending.
- M1.1 Tavern + Hero loop:
  - refresh-based rarity/pity rules and Monte Carlo verification
  - persistent 2-hour refresh cooldown
  - 3 recruitment offers per refresh
  - server-authoritative `refresh_tavern` and `recruit_hero` commands
  - Hall-level hero capacity enforcement
  - PostgreSQL tables/migration for Tavern state and heroes
  - GET `/api/v1/tavern` and `/api/v1/heroes`
  - playable React Tavern screen with guest bootstrap, pity/cooldown, refresh, recruit and roster
  - Vite dev proxy to the Fastify API
- M1.2A team foundation:
  - four persistent team slots
  - maximum four heroes per team
  - server-authoritative assignment validation
  - a hero cannot be assigned to two teams simultaneously
  - GET `/api/v1/teams` + `set_team` command
  - PostgreSQL persistence migration

- M1.2B dungeon run backend:
  - server-generated uint32 root seeds
  - deterministic per-wave seed derivation
  - persisted hero/enemy combat snapshots, full battle-rule snapshot and replay hashes
  - five regular waves plus boss wave generated from validated game-data
  - start/stop dungeon commands and GET `/api/v1/dungeon-runs`
  - one active run per team slot enforced by PostgreSQL
  - rewards stored as replay metadata only; payout/idle accumulation is intentionally deferred
  - current M1 hero stat scaling uses the existing 4%/level simulator formula plus rarity multipliers
  - replay stores the complete battle rules because unit snapshots + seed alone are insufficient if balance constants change later
  - each wave currently starts from its persisted full-stat snapshot; cross-wave HP/MP carryover is not implemented yet
- M1.2 client replay/UI verification:
  - four editable team slots in the React Team & Dungeon screen
  - dungeon start/stop and persisted 6-wave summaries
  - browser client replays every wave from persisted snapshots + seed + battle-rule snapshot
  - visible per-wave hash match/mismatch state
  - Chromium E2E drives the full real UI/API/PostgreSQL flow and verifies all six client hashes match the server

## Next implementation work
1. Add idle cycle accumulation and claim using expected rewards without double-paying replay metadata.
2. Decide and implement cross-wave HP/MP carryover semantics before longer dungeon progression depends on them.
3. Add reward payout/progression integration for completed dungeon cycles.
4. Actual staging VPS/domain deployment remains pending even though deploy infrastructure is scaffolded.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
