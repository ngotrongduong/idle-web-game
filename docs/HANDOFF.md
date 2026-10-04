# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Current milestone
M1 — Core loop (M1.1–M1.6 implemented; M1.5B auto-sell verified; economy tuning in progress).

## Verified status
- M1.5B auto-sell browser E2E and the full pipeline passed GitHub Actions CI #301 on commit `a2b876c2ab2b45d2885be0c29200fa2ccd1ce832`: settings persist across reload, a matching new craft is removed atomically, and the exact quality-scaled manual-sell-equivalent gold is credited.
- M1.5B persisted quality-threshold auto-sell backend/DB/UI passed full GitHub Actions CI #291 on commit `7b901ffb9a8534bfe24970d1348645029990fa61`.
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
  - hero stat scaling uses `levelMult(L)` from docs/03 §2 plus rarity, potential and equipment (`tools/sim` still uses the old 4%/level formula, see Review findings)
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
- M1 economy pass:
  - combined `sim:economy` report now runs in CI
  - initial report found gold/hour deviations of +152.8%, +88.1%, +23.3%, -26.3% across D1–D4
  - enemy gold rewards retuned to ~5.4K / 12.4K / 28.6K / 65.7K online gold/hour targets
  - non-seal material rates retuned to 2% normal / 15% elite / 30% boss ×1–2, targeting ~3.1 minutes for the first craft
  - promotion seal rates remain unchanged
  - +5 currently costs ~1,969 gold expected with pity; after D1 gold retune this is ~21.9 minutes of D1 online gold
  - craft gold sink remains intentionally disabled until cost can scale by item/tier
- M1.6 crafting/enhancement (implemented):
  - recipes are read directly from validated `items.csv` and crafting consumes player materials inside the player transaction
  - provisional closed-beta quality tiers live in `game-data/equipment.ts`: Common 70% ×1.00, Fine 25% ×1.10, Rare 4.5% ×1.25, Masterwork 0.5% ×1.50
  - enhancement +1…+5 uses documented success rates 100/95/90/80/70%, pity +5% per failure and documented stat bonuses +6/+12/+19/+27/+36%
  - current +1…+5 cost is gold-only (100/160/256/410/655); Forging Dust is intentionally deferred because the game currently has no earnable Forging Dust material/source
  - quality and enhancement multipliers are included in newly started dungeon snapshots
- Content re-theme to western high fantasy: display names in `dungeons/enemies/materials/items/classes.csv` changed (Thornwood Forest, Mistmoor Marsh, Sunken Abbey, Dragonfire Crags, goblins, lizardfolk, liches, wyrms…). All ids and stats are unchanged.

## Decisions
- HP/MP fully reset at the start of every wave (each wave replays from the persisted full-stat snapshot). This is the intended M1 rule, not a missing feature; revisit only if dungeon difficulty needs attrition.
- Setting is western high fantasy. Ids such as `bamboo_grove`, `sunken_shrine`, `storm_scribe` are legacy internal identifiers kept for replay/test stability and must never be shown to players; the UI reads names from `/api/v1/catalog`.
- A promoted hero keeps its old snapshot inside any run that already started; promotion is blocked while the hero is in an active run **or a stopped run still owes it rewards**, so the player stops, claims, promotes and restarts. Otherwise EXP earned at the old tier cap would be paid into the new tier.
- A hero whose snapshot is farming in an active run is "busy": it cannot start a second run from another team slot, and its equipment cannot be equipped/unequipped until the run stops (one item must not boost several runs).
- Loot and seal rates are provisional closed-beta values. T1 seals are deliberately generous (≈13 per capped 8h night once the team beats the boss) so the level cap, not the seal, gates the first promotion.

## Next implementation work
1. Verify the M1 economy tuning in CI: dungeon gold/hour must remain within ±20% of targets and the first craft must remain ≤3.6 minutes expected online.
2. Replace the single global `craftGoldCost` with tier/item-aware crafting gold costs before enabling a crafting gold sink; a single flat cost is not suitable across D1–D4.
3. Then move to the next roadmap slice (M1.7 buildings) unless online-presence semantics are prioritized first.
5. Add online-presence semantics if M1 must distinguish 100% online farming from the current passive/offline 75% rate.
6. Actual staging VPS/domain deployment remains pending even though deploy infrastructure is scaffolded.

## Known limitations
- Passive dungeon accrual currently uses the 75% idle/offline rate uniformly. The architecture's separate 100% online rate needs an explicit presence/heartbeat definition before implementation.
- Material ids are still the legacy snake_case names; only display names were re-themed.
- Browser scripts default to the Chrome channel (as on CI); set `GUILDHALL_BROWSER=chromium` to use Playwright's bundled Chromium locally.

## Review findings (2026-10-04)
Review of everything up to `a2b876c` against docs/02–04 and docs/07. Fixed on this branch, each with a regression test that fails on the old code:
- Busy heroes (above): one hero could farm in several active runs by moving between team slots, one item could boost several runs, and stop → promote → claim paid capped EXP into the new tier.
- Tavern pity: a rare/legendary in offer 2 or 3 did not reset the pity counters (they only followed offer 1). Refresh cooldown and offers per refresh now live in `tavern.json`.
- Forge: craft quality roll moved into game-core (`rollCraftQualityBps`); the server now enhances with the game-data table and pity step (`enhancePityStepBps`) that the UI also displays. `forge-odds.test.ts` checks the M1.6 acceptance criterion statistically (quality weights, +1…+5 first-try odds, ≈5.8 attempts to +5).
- Server hardening: a malformed session cookie returned 500 with the decode error; 500s no longer echo internal messages; production refuses to start on the in-memory store; a failed ROLLBACK no longer hides the original error.
- PostgreSQL lists of heroes, items and runs now have a stable `ORDER BY` (equipping used to reshuffle inventory cards under the cursor).
- game-data validation rejects recipes that repeat a material and dungeons without 2 normal + 1 elite + 1 boss enemies.

Open, needs a design decision (not changed yet):
- Combat constants differ from docs/03 §3: fixed K=100 (spec 60+8·L), ±10% variance (±5%), crit 10%/×2.0 with no cap (5%/×1.5, cap 75%); constants are hard-coded instead of game-data.
- MP starts at 0 every wave, so ULTs almost never fire (0 in 1,800 Thornwood waves) and healers never heal.
- Idle rewards come from one fixed replay: restarting until the boss wins pays that win for 8h, and waves after a loss still pay. docs/04 §6 describes expected values from sampled win rates.
- Content is too easy for the new `levelMult` scaling (4 Lv.1 commons clear the Lv.20 dungeon) and dungeons are not unlocked by progress; promotion leaves heroes weaker (Ward Squire Lv10 → Iron Guard Lv1: HP 504 → 380).
- Each of the 3 tavern offers rolls the full rarity table (≈14% of refreshes contain a rare+, docs/03 §7 expects 1 per 20).
- Craft quality reaches +50% (GDD §5.6 says +0–30%); there is no Forge building level yet; Hall parallel-team limit (GDD §5.1) and build timers (M1.7) are missing.
- `tools/sim` does not use the server's hero/enemy formulas, so it cannot be used for the economy pass until it does.

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
