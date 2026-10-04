import { z } from "zod";

export const EquipmentConfigSchema = z.object({
  baseQualityBps: z.number().int().min(10_000).max(20_000),
  maxEnhanceLevel: z.number().int().min(0).max(20),
  sellGoldPerStat: z.number().int().nonnegative(),
  minimumSellGold: z.number().int().nonnegative(),
});

export type EquipmentConfig = z.infer<typeof EquipmentConfigSchema>;

export const equipmentConfig = EquipmentConfigSchema.parse({
  baseQualityBps: 10_000,
  maxEnhanceLevel: 5,
  sellGoldPerStat: 2,
  minimumSellGold: 5,
});

export function itemSellGold(item: { attack: number; defense: number }): number {
  return Math.max(
    equipmentConfig.minimumSellGold,
    (item.attack + item.defense) * equipmentConfig.sellGoldPerStat,
  );
}
