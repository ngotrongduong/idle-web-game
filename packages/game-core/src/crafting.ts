import { SeededRng } from "./rng.js";

export type WeightedQualityTier = {
  weightBps: number;
  multiplierBps: number;
};

/**
 * Picks a craft quality multiplier from tiers whose weights total 10000 bps. Pure and seeded so
 * the server roll can be tested statistically and replayed from its seed.
 */
export function rollCraftQualityBps(
  rng: SeededRng,
  tiers: readonly WeightedQualityTier[],
  fallbackBps: number,
): number {
  const roll = rng.nextInt(10_000);
  let cursor = 0;
  for (const tier of tiers) {
    cursor += tier.weightBps;
    if (roll < cursor) return tier.multiplierBps;
  }
  return fallbackBps;
}
