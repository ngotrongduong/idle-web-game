# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-foundation`

## Resuming in a new session
- Start the session on `chatgpt/m0-foundation`. `main` and PR #2's base branch
  (`claude/web-game-analysis-plan-xumrt0`) do not have the code or the agent tooling yet.
- In a Claude Code cloud session the SessionStart hook installs dependencies and starts PostgreSQL
  with `guildhall_test`; check its status line. Elsewhere follow the `local-ci` skill.
- Read this file, then run `scripts/ci-local.sh --quick` to confirm the checkout is green before
  changing anything.

## Current milestone
M1 — Core loop: M1.1–M1.8 are implemented and the milestone check was run on 2026-10-05 (`docs/09-playtest-m1.md`): a fresh guest played 30 real minutes without getting stuck or hitting a bug. Pacing and clarity are not there yet (dungeon 2 unlocks at minute 6, first T2 at about minute 40, an empty Tavern, 14 idle minutes, engineering jargon in player text); the user decides which of those to fix before M2.

## Verified status
- M1 playtest and balance pass (2026-10-05): the 30-minute fresh-guest run is recorded in `docs/09-playtest-m1.md`. The Forge cap change (migration `0015`) passes the CI steps locally on Windows with PostgreSQL 18: migrations twice, lint, Prettier, typecheck, unit/integration tests on both stores, `sim:economy`, goldens unchanged, six browser E2Es and the build.
- M1.8 language switch: the CI steps pass locally on Windows with PostgreSQL 18 — migrations twice, lint, Prettier, typecheck, unit/integration tests, `sim:economy`, Chromium goldens unchanged, six browser E2Es (the five earlier flows untouched, plus `e2e:language`) and the build. Both languages were also looked at by hand at 375 px. No `plan-reviewer` pass was run on this client-only change.
- M1.7 buildings: GitHub Actions CI #335 passed on `131a175` (branch `claude/m1-7-buildings`), and the same steps pass locally on Windows with PostgreSQL 18 — migrations twice, lint, Prettier, typecheck, unit/integration tests (the building commands run on both the in-memory and the PostgreSQL store), `sim:economy`, Chromium goldens unchanged (v1 `c080875a`, v2 `fce81aeb`), the five browser E2Es (dungeon, promotion, equipment, auto-sell and the new buildings flow) and the build. `scripts/ci-local.sh` itself was not run (bash/Linux script).
- M1.7 review (`plan-reviewer`, 2026-10-05): no duplication, settlement, store-parity or migration finding; follow-ups applied were test coverage (real migration block run twice, racing commands, both stores), whole-cycle income in the second-team estimate and a stale HANDOFF line. Left as is: `upgrade_building` carries no expected level, so a scripted client retrying with a new `cmdId` across the end of a build buys the next level.
- Review follow-up (commits `50696c0`…`0fa1927`) is green on GitHub Actions and locally: lint, Prettier, typecheck, 165 unit/integration tests with PostgreSQL, migrations run twice, Chromium goldens v1 `c080875a` + v2 `fce81aeb`, and the dungeon, promotion, equipment and auto-sell E2Es.
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
  - hero stat scaling uses `levelMult(L)` from docs/03 §2 plus rarity, potential and equipment (now the continuous tier multiplier, shared with `tools/sim`; see Decisions)
  - replay stores the complete battle rules because unit snapshots + seed alone are insufficient if balance constants change later
  - each wave starts from its persisted full-stat snapshot (full HP and 50% MP every wave, see Decisions)
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
  - provisional closed-beta quality tiers live in `game-data/equipment.ts`: Common 70% ×1.00, Fine 25% ×1.10, Rare 4.5% ×1.20, Masterwork 0.5% ×1.30 (capped at +30% per GDD §5.6; migration `0011` remaps older 12500/15000 rows once, recorded in `data_migrations`)
  - enhancement +1…+5 uses documented success rates 100/95/90/80/70%, pity +5% per failure and documented stat bonuses +6/+12/+19/+27/+36%
  - +1…+5 costs 100/160/256/410/655 gold per attempt; since M1.7 each attempt also costs Forge Dust and needs a high enough Forge (see M1.7 below)
  - quality and enhancement multipliers are included in newly started dungeon snapshots
- M1.7 buildings (numbers in `packages/game-data/data/buildings.json`, rules in docs/03 §5–6):
  - `upgrade_building {building: hall | forge}` replaces the instant `upgrade_hall`: gold (and, for the Forge, dungeon materials) is paid at once and the level applies when the build time has passed. Hall follows docs/03 §6 (300 × 2.6^(L−1) gold, 60 s × 1.9^(L−1)); the Forge costs 0.8× in gold and time plus materials.
  - One builder: `players.construction` (jsonb, migration `0014`) holds the single running upgrade; a second one answers `BUILDER_BUSY`.
  - Completion is lazy and pure (`settleConstruction` in game-core): every command and `GET /api/v1/state` / `GET /api/v1/buildings` see the level as of the server clock; nothing is written on read and the version does not change. The next state a command writes persists it.
  - `speed_up_construction {items}` spends Builder's Hourglasses (300 s each, 2% boss drop in every dungeon); the server never uses more than the remaining time needs.
  - Forge level (`players.forge_level`): caps enhancement (Lv1 locked, Lv2–3 +2, Lv4–5 +3, Lv6–7 +4, Lv8+ +5 since the 2026-10-05 balance pass; `FORGE_LEVEL_TOO_LOW`) and shifts craft quality odds 3% per level from Common to the better tiers.
  - Forge Dust: `dismantle_item` turns an unlocked, unequipped item into 1/2/3/5 dust by quality; every enhancement attempt costs 1/2/3/4/5 dust next to the gold (≈18.3 dust expected for +5).
  - `buildServer({ now })` takes a clock, so tests move build timers without waiting.
  - Web: buildings card with countdown, hourglass speed-up, Forge odds and enhancement lock, dismantle button; `e2e:buildings` drives the whole flow in the browser.
  - `sim:economy` reports `buildings` (total gold and build hours, earliest second team) and `enhancement.expectedDust`, with a warning when the second team is slower than the docs/03 §4 target.
- M1.8 language switch (web and `packages/i18n` only; server and contract unchanged):
  - `LocaleProvider` / `useLocale()` (`apps/web/src/locale.tsx`) give every component `t`, `format` (typed `{placeholders}`; a missing parameter throws), `plural`, `number`, `time` and `name` (catalog `nameVi` / `nameEn`). No component names a locale; `packages/i18n/src/messages.ts` holds both dictionaries.
  - The header switch ("Tiếng Việt" / "English") re-renders in place: no reload, no request, and tab, unsaved team draft, countdown and notices survive. `html[lang]` follows it.
  - Every `ApiErrorCode` has an `error.<CODE>` message in both languages (a web test fails when one is missing in either direction); errors are held as keys, so a notice already on screen changes language too.
  - Hardcoded text is gone from the JSX (the bare "gold", "Lv", ATK/DEF, run and wave status values, an item id in an `aria-label`); missing catalog names show "Unknown" / "Không rõ" instead of a humanized id.
  - Found on the way: the Dungeon tab overflowed by 34 px at 360 px wide (fixed with `minmax(0, 1fr)` grid columns), and `text-transform: capitalize` on name blocks was removed because it title-cased English sentences.
  - `e2e:language` checks all of this in an en-US browser at 360 px: no reload and no API call on switch, no Vietnamese letters or raw ids on any tab in English, no leftover English in Vietnamese, a real server error in both languages, persistence across a reload, and the fallback for an unknown stored value.
- Agent tooling: `AGENTS.md` (rules shared by Claude Code, ChatGPT/Codex and humans), `CLAUDE.md` (Claude Code agent team), seven specialists in `.claude/agents/` (game-core, server, web, balance, QA, plan review, docs), skills in `.claude/skills/` (`ship-feature`, `local-ci`, `new-migration`, `balance-pass`, `steward`), a Prettier PostToolUse hook, and `scripts/ci-local.sh` (`pnpm ci:local`), which runs the whole GitHub Actions pipeline locally in about a minute (`--quick` for lint/format/typecheck/test).
- Content re-theme to western high fantasy: display names in `dungeons/enemies/materials/items/classes.csv` changed (Thornwood Forest, Mistmoor Marsh, Sunken Abbey, Dragonfire Crags, goblins, lizardfolk, liches, wyrms…). All ids and stats are unchanged.

## Decisions
- Every wave starts from the persisted full-HP snapshot with **50% MP** (`battle.json` `startingMpBps`), so ULTs and heals fire mid-fight. No HP/MP carries over between waves.
- Battle formula v2 (docs/03 §3) is selected by `battleRules.formulaVersion: 2`; runs persisted earlier have no version and replay with the original v1 code path, bit-for-bit (fixture test in `apps/web/src/replay.test.ts`). Never change v1 or `DEFAULT_BATTLE_RULES`; add a new version instead.
- Stats use one continuous level multiplier across tiers (T2 Lv1 = T1 Lv10, T3 Lv1 = T2 Lv20) and a 1–30 combat level for K; class base stats are unchanged. Promotion therefore never weakens a hero (test over every parent → child pair).
- Idle rewards are the expected value of `rewardSampleCycles` (30) sampled cycles stored on the run; each cycle stops at its first lost wave, cycle c pays sample c % 30, and the run seed hashes player + dungeon + team snapshot + rules so restarting with the same team cannot reroll.
- Dungeons unlock in order (`dungeons.csv` `unlock_after`) once a claim includes a boss kill in the previous dungeon. Parallel teams are capped by Hall level (1/1/2/2/2/3/3/3/4/4). Team 2 needs Hall Lv3 (1,080 gold, 60 s + 114 s of building); with the 1,000 starting gold and dungeon 1 passive income that is reachable at minute ≈4.0 when the Hall is upgraded first (`sim:economy` → `buildings.teamTwo`), inside the docs/03 §4 "team 2 at 6 minutes" target, so the unlock levels stay as in GDD §5.1. The main quest (M2.1) has to steer new players to the two Hall upgrades.
- Building levels are settled lazily from the server clock instead of by a job: a finished construction is applied (without a version bump) whenever the player state is read for a command or returned by the API. Costs are never refunded and a construction cannot be cancelled.
- Enhancement is gated by the Forge level and costs Forge Dust on every attempt, win or lose. Dismantling does not refund enhancement levels. Migration `0014` raised the Forge of players who had already enhanced items so they keep that level.
- Balance pass after the M1 playtest (2026-10-05): each enhancement level above +2 needs a Forge level whose upgrade costs the next dungeon's materials (+3 at Forge Lv4, +4 at Lv6, +5 at Lv8), so the full +5 arrives with dungeon 4 as docs/03 §4 plans instead of on day 1. Gold and dust per attempt are unchanged. Migration `0015` lifts the Forge of players who already own an item above the new cap. Everything else the playtest found is listed in docs/09 §6 and is not changed yet.
- Builder's Hourglass and Forge Dust numbers (drop rate, seconds per item, dust yields and costs, Forge material costs and quality odds) are provisional closed-beta values.
- Language: everyone starts in Vietnamese (GDD §8: `vi` is the default) and the browser language is never read — Vietnam is the launch market and many players there use English browsers. The choice is stored per device in `localStorage` (`guildhall.locale`), not on the account. Numbers are grouped from five digits (`10.000` / `10,000`); four-digit numbers stay plain (`1000`).
- Tavern: only offer 1 can be rare+ (with pity); offers 2–3 roll common/elite. Craft quality tops out at ×1.30.
- Setting is western high fantasy. Ids such as `bamboo_grove`, `sunken_shrine`, `storm_scribe` are legacy internal identifiers kept for replay/test stability and must never be shown to players; the UI reads names from `/api/v1/catalog`.
- A promoted hero keeps its old snapshot inside any run that already started; promotion is blocked while the hero is in an active run **or a stopped run still owes it rewards**, so the player stops, claims, promotes and restarts. Otherwise EXP earned at the old tier cap would be paid into the new tier.
- A hero whose snapshot is farming in an active run is "busy": it cannot start a second run from another team slot, and its equipment cannot be equipped/unequipped until the run stops (one item must not boost several runs).
- Loot and seal rates are provisional closed-beta values. T1 seals are deliberately generous (≈13 per capped 8h night once the team beats the boss) so the level cap, not the seal, gates the first promotion.

## Next implementation work
1. Act on the M1 playtest (docs/09 §6), in the order the user picks: player-facing wording and hints (jargon, recommended level in the dungeon picker, reasons on disabled Start buttons, equip-while-running), dungeon 2 unlocking at minute 6 (tougher dungeon 1 boss for low levels, or several boss kills to unlock), an early extra Tavern refresh, the Forge screen layout. The main quest (M2.1) covers first-step guidance, the T2 timing and the idle gap. Then take PR #2 out of draft.
2. Buildings follow-ups: Tavern and Storage levels (docs/03 §6 ×0.6 / ×0.5), an auto-dismantle option next to auto-sell, and quest/mail sources for Builder's Hourglasses (M2).
3. Economy sim: weight gold/EXP/loot by the sampled win rate of a reference team per dungeon instead of assuming every wave is won.
4. Replace the single global `craftGoldCost` with tier/item-aware crafting gold costs before enabling a crafting gold sink; a single flat cost is not suitable across D1–D4.
5. Add online-presence semantics if M1 must distinguish 100% online farming from the current passive/offline 75% rate.
6. Actual staging VPS/domain deployment remains pending even though deploy infrastructure is scaffolded.

## Known limitations
- Passive dungeon accrual currently uses the 75% idle/offline rate uniformly. The architecture's separate 100% online rate needs an explicit presence/heartbeat definition before implementation.
- Material ids are still the legacy snake_case names; only display names were re-themed.
- A finished construction is not pushed to the client: the web polls `GET /api/v1/buildings` when its countdown ends. Commands never include a level that settled during them in their patch (except `speed_up_construction`, which finishes the build itself).
- Tavern and Storage have no building level yet; the Hall costs gold only.
- i18n uses `{name}` placeholders and `.one` / `.other` plural keys, a subset of the ICU format that docs/04–05 name. Error texts are static per code: `TAVERN_COOLDOWN` cannot say when the next refresh is (the Tavern card shows it), because the time only exists inside the server's English message. `/api/v1/promotion` still returns `currentClassNameVi`, which the client no longer reads.
- Browser scripts default to the Chrome channel (as on CI); set `GUILDHALL_BROWSER=chromium` to use Playwright's bundled Chromium locally.

## Review findings (2026-10-04)
Review of everything up to `a2b876c` against docs/02–04 and docs/07. Fixed on this branch, each with a regression test that fails on the old code:
- Busy heroes (above): one hero could farm in several active runs by moving between team slots, one item could boost several runs, and stop → promote → claim paid capped EXP into the new tier.
- Tavern pity: a rare/legendary in offer 2 or 3 did not reset the pity counters (they only followed offer 1). Refresh cooldown and offers per refresh now live in `tavern.json`.
- Forge: craft quality roll moved into game-core (`rollCraftQualityBps`); the server now enhances with the game-data table and pity step (`enhancePityStepBps`) that the UI also displays. `forge-odds.test.ts` checks the M1.6 acceptance criterion statistically (quality weights, +1…+5 first-try odds, ≈5.8 attempts to +5).
- Server hardening: a malformed session cookie returned 500 with the decode error; 500s no longer echo internal messages; production refuses to start on the in-memory store; a failed ROLLBACK no longer hides the original error.
- PostgreSQL lists of heroes, items and runs now have a stable `ORDER BY` (equipping used to reshuffle inventory cards under the cursor).
- game-data validation rejects recipes that repeat a material and dungeons without 2 normal + 1 elite + 1 boss enemies.

Design decisions taken by the user and implemented afterwards:
- Combat follows docs/03 §3 with 50% starting MP (`50696c0` safety nets, `646b2c0` formula v2 + v2 golden, constants in `battle.json`).
- Idle rewards = expected value of sampled cycles (`31b7c0e`, migration `0012`).
- Dungeon unlock + Hall team limit (`0fa1927`, migration `0013` with a one-shot backfill); enemy stats rebalanced per dungeon in `battle.json` with win-rate band tests for every T1 trio (`tools/sim/test/balance.test.ts`).
- Promotion keeps strength via the continuous tier multiplier (instead of raising T2/T3 base stats, which compounded to T3 ≈26× T1).
- Tavern offers 2–3 common/elite only; craft quality capped at ×1.30 (`8167936`, migration `0011`).
- `tools/sim` builds teams and enemies with the server's own builders (`buildHeroCombatant`, `buildEnemyCombatant`, `selectWaveEnemies`).

Still open:
- The economy sim still assumes every wave is won; with sampled rewards, real gold/hour also depends on the team's win rate, and the server always pays the 75% passive rate (no online presence yet).

## Important constraints
- Keep `main` deployable; use small PRs.
- Do not copy third-party names, art, lore, UI, source code, or data tables from the reference game.
- Game logic remains server-authoritative and deterministic.
- `packages/game-core` must not use ambient random calls.
- Prefer integer or basis-point math inside battle simulation.
- Auth/session randomness is cryptographic server randomness and is separate from deterministic game RNG.
