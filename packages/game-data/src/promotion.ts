import { z } from "zod";
import rawPromotionConfig from "../data/promotion.json" with { type: "json" };

export const PromotionRuleSchema = z.object({
  fromTier: z.number().int().min(1).max(2),
  sealMaterialId: z.string().min(1),
  sealQty: z.number().int().positive(),
  goldCost: z.number().int().nonnegative(),
});

export type PromotionRule = z.infer<typeof PromotionRuleSchema>;

export const PromotionConfigSchema = z.object({
  retainedPotentialBps: z.number().int().min(0).max(10_000),
  rules: z.array(PromotionRuleSchema).length(2),
});

export type PromotionConfig = z.infer<typeof PromotionConfigSchema>;

export const promotionConfig = PromotionConfigSchema.parse(rawPromotionConfig);

export function promotionRuleForTier(tier: number): PromotionRule | undefined {
  return promotionConfig.rules.find((rule) => rule.fromTier === tier);
}
