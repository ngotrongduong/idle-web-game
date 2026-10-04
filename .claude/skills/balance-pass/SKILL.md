---
name: balance-pass
description: Workflow for tuning game numbers with evidence — which config knob controls what, how to regenerate data, which simulations and band tests prove the change, and how to report it against docs/03 targets. Use for difficulty, reward, loot, pacing or odds changes.
argument-hint: "[what to tune, e.g. D3 too hard for mid T2]"
---

# Balance pass: $ARGUMENTS

## Knobs (config only)

| Lever | File | Status |
|---|---|---|
| Enemy HP/ATK/DEF per dungeon | `packages/game-data/data/battle.json` → `enemyStatMultiplierBps` | free |
| Enemy base stats, gold/EXP rewards | `packages/game-data/data/enemies.csv` | free |
| Dungeon order, recommended level, waves | `packages/game-data/data/dungeons.csv` | free |
| Class base stats | `classes.csv`, `class-families.csv` | free |
| Material drops and seal rates | `packages/game-data/data/loot.json` | free |
| Cycle length, offline efficiency/cap | `packages/game-data/data/idle.json` | free |
| Promotion costs | `packages/game-data/data/promotion.json` | free |
| Combat constants (v2), starting MP, max turns | `battle.json` | locked (user decision) |
| Reward sample count (30) | `idle.json` | locked |
| Tavern odds and pity | `packages/game-data/data/tavern.json` | locked |
| Craft quality tiers (×1.30 cap), enhancement odds/costs | `packages/game-data/src/equipment.ts` | lead's brief only (game-core-engineer's directory) |

Level growth is not a knob: it is the `tierLevelMultiplierBps` formula in
`packages/game-core/src/hero-stats.ts` (a locked decision).

After editing a CSV run `pnpm --filter @idle/game-data build` (regenerates `generated/config.json`).

## Targets (docs/03, HANDOFF Decisions)
- Online gold/hour ≈ 5.4K / 12.4K / 28.6K / 65.7K for D1–D4 (±20% before `sim:economy` warns).
- First craft ≈ 3 minutes of D1 farming.
- Difficulty bands asserted by `tools/sim/test/balance.test.ts` (120 seeds per wave):
  - every T1 Common trio at Lv1: D1 wave 1 ≥ 70%, D1 boss ≤ 50%, D2 boss ≤ 10%;
  - every T1 Common trio at Lv10 (T1 cap): D1 boss ≥ 90%, D2 boss 40–90%;
  - one hero per family: D3 boss ≤ 15% at combat level 10 (T1 cap) and ≥ 85% at 20 (T2 cap);
    D4 boss ≤ 15% at 20 and ≥ 90% at 30 (T3 cap).
  Keep draws rare (check `sim:battle`).
- Promotion never weakens a hero; T1 seals should not be the bottleneck of the first promotion.

## Measure
```bash
pnpm --filter @idle/sim test          # band tests (also run in CI)
pnpm --filter @idle/sim sim:battle    # win rates per dungeon wave
pnpm --filter @idle/sim sim:economy   # gold/EXP per hour, loot, craft time, enhancement cost, warnings
pnpm --filter @idle/sim sim:gacha     # tavern odds and pity
pnpm --filter @idle/sim sim:upgrade   # enhancement attempt percentiles
```
Capture the output before and after the change.

## Known gaps
- `sim:economy` assumes every wave is won; real payout is the expected value of 30 sampled cycles
  that stop at the first loss, so a team below the band earns less than the report.
- The server pays the 75% passive rate everywhere (no online-presence rate yet).

## Report
Table per metric: target, before, after. Plus the files changed, the test results, and the docs/03
lines that now need new numbers (hand those to `docs-keeper`).
