import { z } from "zod";
import rawTavernConfig from "../data/tavern.json" with { type: "json" };

const RarityBpsSchema = z.object({
  common: z.number().int().nonnegative(),
  elite: z.number().int().nonnegative(),
  rare: z.number().int().nonnegative(),
  legendary: z.number().int().nonnegative(),
});

export const TavernConfigSchema = z
  .object({
    baseRarityBps: RarityBpsSchema,
    rarityStatMultiplierBps: RarityBpsSchema,
    rarePityRefreshes: z.number().int().positive(),
    legendaryPityRefreshes: z.number().int().positive(),
    legendarySoftPityStart: z.number().int().positive(),
    legendarySoftPityStepBps: z.number().int().nonnegative(),
    refreshCooldownSeconds: z.number().int().positive(),
    offersPerRefresh: z.number().int().positive(),
  })
  .superRefine((config, context) => {
    const total = Object.values(config.baseRarityBps).reduce((sum, value) => sum + value, 0);
    if (total !== 10_000) {
      context.addIssue({
        code: "custom",
        message: `base rarity probabilities must total 10000 bps, got ${total}`,
      });
    }

    if (config.legendarySoftPityStart >= config.legendaryPityRefreshes) {
      context.addIssue({
        code: "custom",
        message: "legendary soft pity must start before hard pity",
      });
    }

    if (config.rarePityRefreshes > config.legendaryPityRefreshes) {
      context.addIssue({
        code: "custom",
        message: "rare+ pity cannot be later than legendary pity",
      });
    }
  });

export type TavernConfig = z.infer<typeof TavernConfigSchema>;

export const tavernConfig = TavernConfigSchema.parse(rawTavernConfig);
