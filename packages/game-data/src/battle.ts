import { z } from "zod";
import rawBattleConfig from "../data/battle.json" with { type: "json" };

const Bps = z.number().int().min(0).max(10_000);
const PositiveInt = z.number().int().positive();

const EnemyStatMultiplierSchema = z.object({
  hp: PositiveInt,
  attack: PositiveInt,
  defense: PositiveInt,
});

/** Battle formula v2 constants (docs/03 §3) plus how heroes and enemies enter a wave. */
export const BattleConfigSchema = z
  .object({
    formulaVersion: z.literal(2),
    maxTurns: PositiveInt,
    defenseKBase: PositiveInt,
    defenseKPerLevel: z.number().int().nonnegative(),
    varianceMinBps: PositiveInt,
    varianceMaxBps: PositiveInt,
    defaultCritBps: Bps,
    rangedCritBonusBps: Bps,
    critMultiplierBps: PositiveInt,
    critCapBps: Bps,
    mpMax: PositiveInt,
    mpPerAction: z.number().int().nonnegative(),
    mpOnHit: z.number().int().nonnegative(),
    startingMpBps: Bps,
    advantageMultiplierBps: PositiveInt,
    disadvantageMultiplierBps: PositiveInt,
    enemyStatMultiplierBps: z.record(z.string(), EnemyStatMultiplierSchema),
  })
  .superRefine((config, context) => {
    if (config.varianceMaxBps < config.varianceMinBps) {
      context.addIssue({ code: "custom", message: "varianceMaxBps must be >= varianceMinBps" });
    }
  });

export type BattleConfig = z.infer<typeof BattleConfigSchema>;

export const battleConfig = BattleConfigSchema.parse(rawBattleConfig);
