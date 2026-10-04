# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M1 — Core loop.

## Verified status
- GitHub Actions CI run #131 passed on commit `017b65998b8854cefd3988f2073ae9dae85a55ff`.
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

## Next implementation work
1. M1.2: persistent teams and hero assignment.
2. Add dungeon run start/stop commands using server-generated deterministic battle seeds.
3. Generate the full 5 regular waves + boss wave from validated dungeon/enemy data and persist run/replay state.
4. Add the web Team & Dungeon screen and replay the server result client-side from the same seed.
5. Add end-to-end tests proving client/server replay results and hashes match.
6. Actual staging VPS/domain deployment remains pending even though deploy infrastructure is scaffolded.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
