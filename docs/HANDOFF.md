# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M1 — Core loop.

## Verified status
- GitHub Actions CI run #214 passed on commit `cc7f03d24dc220429e5f5942393fe73ccbb5315c`.
- M1.4A hero EXP → level progression is verified end-to-end: dungeon claim now applies the documented XP curve, persists level/EXP consistently in memory and PostgreSQL, and discards EXP beyond the current class tier cap.
- The verified browser/PostgreSQL flow now covers guest → Tavern refresh → recruit 3 heroes → save Team 1 → start a deterministic 6-wave dungeon → verify 6/6 client replay hashes → simulate +3 hours offline → accrue exactly 168 cycles → claim exact gold + EXP → reset pending rewards to zero.
- Idle timing now matches the balancing document: 8 seconds per wave × 6 waves = 48-second nominal cycle; at 75% offline efficiency that becomes 64 seconds per credited cycle, capped at 8 hours.
- Frozen install, PostgreSQL migrations, lint, Prettier check, typecheck, unit/integration tests, Chromium golden battle, dungeon E2E, build and Docker Compose validation are green.
- PostgreSQL integration tests cover session expiry, 24h idempotency retention/pruning, transaction rollback, row-lock serialization, Tavern persistence, heroes, teams, dungeon replay persistence and idle reward fields.
- Temporary format-once workflows have been removed; CI is read-only again.
- Keep PR #2 draft while M1 continues. Do not merge unfinished M1 work.

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
- M1.3 idle/offline catch-up + claim:
  - data-driven 48-second six-wave cycle, 75% passive/offline efficiency and 8-hour cap
  - pure game-core accrual math preserves partial-cycle time and discards time older than the cap
  - PostgreSQL persists `lastAccruedAt`, pending cycles/gold/EXP and completed cycle count
  - server-authoritative `claim_dungeon_rewards` with player row locking, versioning and command idempotency
  - rewards are paid only on claim; replay reward metadata is never double-paid
  - EXP is paid to hero IDs stored in the run snapshot, not whichever heroes happen to be in the team later
  - React UI shows pending cycles/gold/EXP, total cycles, player gold and hero EXP; dungeon progress polls without overwriting unsaved team drafts
  - Chromium/PostgreSQL E2E backdates a run exactly three hours, verifies 168 credited cycles and exact reward math, then claims through the real UI and verifies pending rewards reset to zero
- M1.4A hero level progression:
  - `xpToNext(level, tier) = round((20 + 18 * level^1.7) * 1.6^(tier-1))`
  - tier level caps are 10/20/30 for T1/T2/T3
  - multi-level gains carry in-tier EXP remainder
  - reaching the current tier cap forces EXP to zero and discards additional EXP until promotion
  - server progression service derives tier from validated class data; DB adapters only persist level/EXP
  - Chromium E2E independently re-computes expected T1 progression instead of calling production helpers

## Next implementation work
1. M1.4B: implement T1 → T2 → T3 branch selection/promotion plus the 20% retained-potential rule; promotion-seal inventory must be integrated cleanly rather than bypassed.
2. Define promotion-seal material IDs/costs in game-data and persist player material inventory before exposing promotion commands.
3. Decide cross-wave HP/MP carryover semantics before deeper dungeon difficulty/progression depends on them.
4. Add online-presence semantics if M1 must distinguish 100% online farming from the current passive/offline 75% rate.
5. Actual staging VPS/domain deployment remains pending even though deploy infrastructure is scaffolded.

## Known M1.3 limitations
- Passive dungeon accrual currently uses the 75% idle/offline rate uniformly. The architecture's separate 100% online rate needs an explicit presence/heartbeat definition before implementation.
- Cross-wave HP/MP carryover is still not implemented; each stored wave currently begins from its persisted full-stat snapshot.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
