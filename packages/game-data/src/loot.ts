import { z } from "zod";
import type { PromotionConfig } from "./promotion.js";
import type { GameData } from "./schema.js";

export const LootRankSchema = z.enum(["normal", "elite", "boss"]);

export const LootRuleSchema = z
  .object({
    dungeonId: z.string().min(1),
    rank: LootRankSchema,
    materialId: z.string().min(1),
    chanceBps: z.number().int().min(1).max(10_000),
    minQty: z.number().int().positive(),
    maxQty: z.number().int().positive(),
  })
  .refine((rule) => rule.minQty <= rule.maxQty, { message: "minQty must be <= maxQty" });

export type LootRule = z.infer<typeof LootRuleSchema>;

export const LootConfigSchema = z.object({
  rules: z.array(LootRuleSchema).min(1),
});

export type LootConfig = z.infer<typeof LootConfigSchema>;

/**
 * Validates the loot table against the content it references: every rule must point at an
 * existing dungeon and material, and every promotion seal must drop from at least one boss so
 * promotion is reachable through normal play.
 */
export function validateLootConfig(
  input: unknown,
  gameData: GameData,
  promotion: PromotionConfig,
): LootConfig {
  const config = LootConfigSchema.parse(input);
  const materialIds = new Set(gameData.materials.map((entry) => entry.id));
  const dungeonIds = new Set(gameData.dungeons.map((entry) => entry.id));
  const seen = new Set<string>();

  for (const rule of config.rules) {
    if (!dungeonIds.has(rule.dungeonId)) {
      throw new Error(`Loot rule references missing dungeon ${rule.dungeonId}`);
    }
    if (!materialIds.has(rule.materialId)) {
      throw new Error(`Loot rule references missing material ${rule.materialId}`);
    }
    const key = `${rule.dungeonId}:${rule.rank}:${rule.materialId}`;
    if (seen.has(key)) throw new Error(`Duplicate loot rule ${key}`);
    seen.add(key);
  }

  for (const rule of promotion.rules) {
    if (!materialIds.has(rule.sealMaterialId)) {
      throw new Error(`Promotion seal ${rule.sealMaterialId} is not a known material`);
    }
    const hasBossSource = config.rules.some(
      (entry) => entry.rank === "boss" && entry.materialId === rule.sealMaterialId,
    );
    if (!hasBossSource) {
      throw new Error(`Promotion seal ${rule.sealMaterialId} has no boss loot source`);
    }
  }

  return config;
}
