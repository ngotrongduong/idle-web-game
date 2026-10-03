# HANDOFF — Project Guildhall

## Current branch
`chatgpt/m0-battle-v2`

## Branch relationship
This branch stacks on `chatgpt/m0-content-slice` / PR #3, which stacks on foundation PR #2.

## Completed here
- Preserved legacy `simulateWave` v1 unchanged, including its existing golden replay hash.
- Added versioned `simulateWaveV2` with deterministic MP:
  - +10 MP at the start of each own action.
  - +5 MP when hit by a damaging action.
  - ULT automatically fires at 100 MP and resets actor MP to 0.
- Added data-driven ULT effects: single/AoE damage, single/AoE healing and party shielding.
- Added data-driven passive bonuses for HP / attack / defense / speed.
- Shield absorbs damage before HP while still counting as a hit for MP.
- Added deterministic lowest-HP-ratio targeting and seeded basic-attack targeting.
- V2 replay event/hash format includes action, skill, HP, shield and MP state.
- `tools/sim` now consumes class ULT/passive config from `@idle/game-data` and simulates with v2.
- Battle simulation summary now reports average ULT actions.

## Verification status
Runtime package installation remains blocked in this environment. V1 remains the regression baseline; v2 has dedicated golden/replay tests but they still need to run after the root lockfile is regenerated.

## Next work
1. Add persistent wave state so a six-wave dungeon run carries HP/MP/shield forward.
2. Build `simulateDungeonRunV2` using configured wave/boss data.
3. Add reward rolls from dungeon config using the same seeded RNG lineage.
4. Run 10k simulations per dungeon and tune class/enemy numbers.
