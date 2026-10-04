import { z } from "zod";

export const CraftQualityTierSchema = z.object({
  id: z.string().min(1),
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  weightBps: z.number().int().min(0).max(10_000),
  multiplierBps: z.number().int().min(10_000).max(20_000),
  /** Forge Dust returned when an item of this quality is dismantled. */
  dismantleDust: z.number().int().positive(),
});

export const EquipmentConfigSchema = z.object({
  baseQualityBps: z.number().int().min(10_000).max(20_000),
  maxEnhanceLevel: z.number().int().min(0).max(20),
  sellGoldPerStat: z.number().int().nonnegative(),
  minimumSellGold: z.number().int().nonnegative(),
  craftGoldCost: z.number().int().nonnegative(),
  qualityTiers: z.array(CraftQualityTierSchema).min(1),
  enhanceBonusBps: z.array(z.number().int().nonnegative()).length(6),
  enhanceGoldCosts: z.array(z.number().int().nonnegative()).length(5),
  /** Forge Dust per attempt, next to the gold cost (docs/03 §5). */
  enhanceDustCosts: z.array(z.number().int().nonnegative()).length(5),
  forgeDustMaterialId: z.string().min(1),
  enhanceSuccessBps: z.array(z.number().int().min(0).max(10_000)).length(5),
  enhancePityStepBps: z.number().int().min(0).max(10_000),
});

export type EquipmentConfig = z.infer<typeof EquipmentConfigSchema>;
export type CraftQualityTier = z.infer<typeof CraftQualityTierSchema>;

export const equipmentConfig = EquipmentConfigSchema.parse({
  baseQualityBps: 10_000,
  maxEnhanceLevel: 5,
  sellGoldPerStat: 2,
  minimumSellGold: 5,
  craftGoldCost: 0,
  qualityTiers: [
    {
      id: "common",
      nameVi: "Thường",
      nameEn: "Common",
      weightBps: 7_000,
      multiplierBps: 10_000,
      dismantleDust: 1,
    },
    {
      id: "fine",
      nameVi: "Tinh xảo",
      nameEn: "Fine",
      weightBps: 2_500,
      multiplierBps: 11_000,
      dismantleDust: 2,
    },
    {
      id: "rare",
      nameVi: "Hiếm",
      nameEn: "Rare",
      weightBps: 450,
      multiplierBps: 12_000,
      dismantleDust: 3,
    },
    {
      id: "masterwork",
      nameVi: "Kiệt tác",
      nameEn: "Masterwork",
      weightBps: 50,
      multiplierBps: 13_000,
      dismantleDust: 5,
    },
  ],
  enhanceBonusBps: [0, 600, 1_200, 1_900, 2_700, 3_600],
  enhanceGoldCosts: [100, 160, 256, 410, 655],
  enhanceDustCosts: [1, 2, 3, 4, 5],
  forgeDustMaterialId: "forge_dust",
  enhanceSuccessBps: [10_000, 9_500, 9_000, 8_000, 7_000],
  enhancePityStepBps: 500,
});

const totalQualityWeight = equipmentConfig.qualityTiers.reduce(
  (sum, tier) => sum + tier.weightBps,
  0,
);
if (totalQualityWeight !== 10_000) {
  throw new Error(`craft quality weights must total 10000 bps, got ${totalQualityWeight}`);
}
// GDD §5.6: crafted quality adds +0–30%.
export const MAX_CRAFT_QUALITY_BPS = 13_000;
if (equipmentConfig.qualityTiers.some((tier) => tier.multiplierBps > MAX_CRAFT_QUALITY_BPS)) {
  throw new Error(`craft quality multipliers must not exceed ${MAX_CRAFT_QUALITY_BPS} bps`);
}

export function itemSellGold(item: { attack: number; defense: number }): number {
  return Math.max(
    equipmentConfig.minimumSellGold,
    (item.attack + item.defense) * equipmentConfig.sellGoldPerStat,
  );
}

export function enhancementBonusBps(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > equipmentConfig.maxEnhanceLevel) {
    throw new Error(`enhance level must be 0..${equipmentConfig.maxEnhanceLevel}`);
  }
  return equipmentConfig.enhanceBonusBps[level]!;
}

export function enhancementGoldCost(currentLevel: number): number {
  if (
    !Number.isInteger(currentLevel) ||
    currentLevel < 0 ||
    currentLevel >= equipmentConfig.maxEnhanceLevel
  ) {
    throw new Error(`current enhance level must be 0..${equipmentConfig.maxEnhanceLevel - 1}`);
  }
  return equipmentConfig.enhanceGoldCosts[currentLevel]!;
}

export function enhancementDustCost(currentLevel: number): number {
  if (
    !Number.isInteger(currentLevel) ||
    currentLevel < 0 ||
    currentLevel >= equipmentConfig.maxEnhanceLevel
  ) {
    throw new Error(`current enhance level must be 0..${equipmentConfig.maxEnhanceLevel - 1}`);
  }
  return equipmentConfig.enhanceDustCosts[currentLevel]!;
}

/**
 * Forge Dust for dismantling an item: the yield of the best quality tier the item reaches.
 * Enhancement levels are not refunded.
 */
export function dismantleDustForQuality(qualityBps: number): number {
  const reached = equipmentConfig.qualityTiers.filter((tier) => tier.multiplierBps <= qualityBps);
  const best = reached.reduce(
    (top, tier) => (tier.multiplierBps > top.multiplierBps ? tier : top),
    equipmentConfig.qualityTiers[0]!,
  );
  return best.dismantleDust;
}

export function equipmentStatValue(base: number, qualityBps: number, enhanceLevel: number): number {
  const enhanceMultiplierBps = 10_000 + enhancementBonusBps(enhanceLevel);
  return Math.floor((base * qualityBps * enhanceMultiplierBps) / 100_000_000);
}
