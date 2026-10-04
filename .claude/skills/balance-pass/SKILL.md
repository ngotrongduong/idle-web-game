---
name: balance-pass
description: Workflow for tuning game numbers with evidence — which config knob controls what, how to regenerate data, which simulations and band tests prove the change, and how to report it against docs/03 targets. Use for difficulty, reward, loot, pacing or odds changes.
argument-hint: "[what to tune, e.g. D3 too hard for mid T2]"
---

# Balance pass: $ARGUMENTS

## Knobs (config only)

| Lever | File |
|---|---|
| Combat constants (v2), starting MP, max turns | `packages/game-data/data/battle.json` |
| Enemy HP/ATK/DEF per dungeon | `battle.json` → `enemyStatMultiplierBps` |
| Enemy base stats, gold/EXP rewards | `packages/game-data/data/enemies.csv` |
| Dungeon order, recommended level, waves | `packages/game-data/data/dungeons.csv` |
| Class base stats and growth | `classes.csv`, `class-families.csv` |
| Material drops and seal rates | `packages/game-data/data/loot.json` |
| Cycle length, offline efficiency/cap, reward samples | `packages/game-data/data/idle.json` |
| Tavern odds, pity, cooldown | `packages/game-data/data/tavern.json` |
| Promotion costs, potential retention | `packages/game-data/data/promotion.json` |
| Craft quality tiers, enhancement odds/costs | `packages/game-data/src/equipment.ts` |

After editing a CSV run `pnpm --filter @idle/game-data build` (regenerates `generated/config.json`).

## Targets (docs/03, HANDOFF Decisions)
- Online gold/hour ≈ 5.4K / 12.4K / 28.6K / 65.7K for D1–D4 (±20% before `sim:economy` warns).
- First craft ≈ 3 minutes of D1 farming.
- Difficulty bands (`tools/sim/test/balance.test.ts`, every T1 Common trio): fresh Lv1 recruits farm
  D1 waves but do not beat its boss reliably; D1 boss ≥ 90% at T1 Lv10; D2 gated by the T1 cap;
  D3 needs mid T2; D4 needs mid T3; draws stay under 2%.
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
