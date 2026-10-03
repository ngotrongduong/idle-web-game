# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-battle-v2`

## Branch relationship
This branch stacks on `chatgpt/m0-content-slice` / PR #3, which stacks on foundation PR #2.

## Completed here
- Preserved legacy `simulateWave` v1 unchanged and retained golden hash `c080875a`.
- Added versioned `simulateWaveV2` with deterministic MP, ULT, healing, shielding and passives.
- V2 golden replay: seed 123 → draw, 60 actions, 62 event records, hash `72445318`.
- Added exported battle-state snapshots and optional initial ally state.
- Added `simulateDungeonRunV2`: HP/MP/shield carry between waves; each wave gets a deterministic child seed; run stops on lose/draw.
- Overall dungeon replay hash includes wave IDs, child seeds, wave hashes and final ally state.
- `tools/sim` consumes class skills/passives, configured dungeon waves and bosses directly from `@idle/game-data`.
- Added `pnpm sim:dungeon -- --runs 10000 [--dungeon bamboo_grove]`.
- Dungeon simulation reports completion rate, average waves cleared, average turns and P90 turns.

## Verification status
Runtime package installation remains blocked in this environment. The new logic has deterministic/golden/state-carry tests committed, but the full TypeScript suite must still be executed after regenerating the root lockfile.

## Next work
1. Add seeded reward rolls and expected-value reward summaries.
2. Run 10k dungeon simulations after dependencies are installable and tune class/enemy/boss numbers.
3. Add idle/offline catch-up using dungeon simulation samples.
4. Keep PostgreSQL/Drizzle persistence on a separate infrastructure branch.
