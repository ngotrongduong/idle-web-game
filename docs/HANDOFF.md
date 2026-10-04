# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M1 — Core loop (M1.1–M1.5A verified; M1.6 crafting/enhancement in progress).

## Verified status
- M1.5B persisted quality-threshold auto-sell passed full GitHub Actions CI #291 on commit `7b901ffb9a8534bfe24970d1348645029990fa61`; browser E2E is now being added.
- Forge equipment browser E2E passed GitHub Actions CI #282 on commit `ccf6a5a15bf4e9339576d69cbd1ffcb56516ebc6`: baseline dungeon → craft → guaranteed +1 → equip → stronger fresh dungeon snapshot → replay match.
- M1.6 crafting/quality/enhancement core passed GitHub Actions CI #280 on commit `7d66a812a5f45adba113bd1b4cefc1d474a754ad`.
- M1.5A inventory/equipment + Forge UI passed GitHub Actions CI #269 on commit `a4da8e92437ec54cbaea85bd321a7cdc5ea0fbdb`.
- M1.4B (promotion + dungeon loot) is verified locally with the full CI-equivalent run: frozen install, migrations through `0007`, lint, Prettier, typecheck, unit/integration tests (InMemory + PostgreSQL), Chromium golden battle (`c080875a`, unchanged by the content re-theme), dungeon E2E, the new promotion E2E, build and Docker Compose validation.
- New browser/PostgreSQL flow (`pnpm --filter @idle/inspect e2e:promotion`): guest → recruit 3 heroes → Team 1 → start → backdate past the 8h cap → claim 450 cycles (all heroes reach Lv.10) → stop/restart so the run snapshots the capped heroes → backdate + claim 450 cycles → inventory equals the sum of both claims and holds T1 seals → stop → promote through the Tavern UI → hero is T2 Lv.1 with retained potential, 1 seal and 500 gold spent.
- Earlier: GitHub Actions CI run #214 passed on commit `cc7f03d24dc220429e5f5942393fe73ccbb5315c`.
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
  - each wave starts from its persisted full-stat snapshot (full HP/MP every wave, see Decisions)
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

- M1.4B tier promotion:
  - `promotion.json`: T1→T2 costs 1 `promotion_seal_t1` + 500 gold, T2→T3 costs 2 `promotion_seal_t2` + 3000 gold; 20% of the current scaled stats is retained as hero `potential` (jsonb)
  - server-authoritative `promote_hero` (direct child classes only, hero must be at its tier cap and not inside an active run); GET `/api/v1/promotion` and `/api/v1/materials`
  - `player_materials` inventory table (migration `0006`), Tavern roster shows tier/cap/cost, seal counts and promote buttons
- M1.4B dungeon loot:
  - `packages/game-data/data/loot.json`: per dungeon × enemy rank rules (`chanceBps`, `minQty`, `maxQty`); validation requires existing dungeons/materials, no duplicates, and at least one boss source for every promotion seal
  - provisional rates: normal 0.5%, elite 5%, boss 10% (qty 1–2) per dungeon material; `promotion_seal_t1` 3% from Thornwood/Mistmoor bosses, `promotion_seal_t2` 1.5% from Sunken Abbey/Dragonfire Crags bosses
  - `game-core/loot.ts`: `deriveCycleLootSeed(runSeed, cycleIndex)` + `rollLoot` on `SeededRng`; every idle cycle index has its own seed, so splitting claims never changes the total
  - only enemies from won waves drop loot (same rule as gold/EXP); accrual adds to `dungeon_runs.pending_materials` (migration `0007`), claim credits `player_materials` and reports `materials` in `dungeon_rewards_claimed`
  - public GET `/api/v1/catalog` serves localized class/dungeon/material names; the web client no longer shows legacy ids
  - web shows pending loot, a last-claim notice and a materials inventory card
- M1.5B auto-sell:
  - persisted per-player setting with default OFF
  - quality threshold uses configured craft quality multipliers
  - newly crafted equipment at or below the threshold is sold atomically inside the command transaction
  - auto-sell uses the exact same quality-scaled sell formula as manual sell
  - locked/equipped existing items remain protected because auto-sell only acts on newly acquired items
  - Forge UI exposes enable/disable and quality threshold controls
- M1.6 crafting/enhancement (implementation in progress):
  - recipes are read directly from validated `items.csv` and crafting consumes player materials inside the player transaction
  - provisional closed-beta quality tiers live in `game-data/equipment.ts`: Common 70% ×1.00, Fine 25% ×1.10, Rare 4.5% ×1.25, Masterwork 0.5% ×1.50
  - enhancement +1…+5 uses documented success rates 100/95/90/80/70%, pity +5% per failure and documented stat bonuses +6/+12/+19/+27/+36%
  - current +1…+5 cost is gold-only (100/160/256/410/655); Forging Dust is intentionally deferred because the game currently has no earnable Forging Dust material/source
  - quality and enhancement multipliers are included in newly started dungeon snapshots
- Content re-theme to western high fantasy: display names in `dungeons/enemies/materials/items/classes.csv` changed (Thornwood Forest, Mistmoor Marsh, Sunken Abbey, Dragonfire Crags, goblins, lizardfolk, liches, wyrms…). All ids and stats are unchanged.

## Decisions
- HP/MP fully reset at the start of every wave (each wave replays from the persisted full-stat snapshot). This is the intended M1 rule, not a missing feature; revisit only if dungeon difficulty needs attrition.
- Setting is western high fantasy. Ids such as `bamboo_grove`, `sunken_shrine`, `storm_scribe` are legacy internal identifiers kept for replay/test stability and must never be shown to players; the UI reads names from `/api/v1/catalog`.
- A promoted hero keeps its old snapshot inside any run that already started; promotion is blocked while the hero is in an active run, so the player stops and restarts the run to use the new class.
- Loot and seal rates are provisional closed-beta values. T1 seals are deliberately generous (≈13 per capped 8h night once the team beats the boss) so the level cap, not the seal, gates the first promotion.

## Next implementation work
1. Verify the new auto-sell browser E2E: settings persist, matching craft disappears, exact manual-sell-equivalent gold is credited.
2. Economy pass with `tools/sim`: idle gold, sell values, material/seal rates, crafting costs and enhancement costs must be tuned together.
5. Add online-presence semantics if M1 must distinguish 100% online farming from the current passive/offline 75% rate.
6. Actual staging VPS/domain deployment remains pending even though deploy infrastructure is scaffolded.

## Known limitations
- Passive dungeon accrual currently uses the 75% idle/offline rate uniformly. The architecture's separate 100% online rate needs an explicit presence/heartbeat definition before implementation.
- Material ids are still the legacy snake_case names; only display names were re-themed.
- Browser scripts default to the Chrome channel (as on CI); set `GUILDHALL_BROWSER=chromium` to use Playwright's bundled Chromium locally.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
