import { describe, expect, it } from "vitest";
import { foundationGameData } from "./index";
import { promotionConfig, promotionRuleForTier } from "./promotion";

describe("promotion config", () => {
  it("retains 20% pre-promotion stats and references real seal materials", () => {
    expect(promotionConfig.retainedPotentialBps).toBe(2_000);
    const materialIds = new Set(foundationGameData.materials.map((entry) => entry.id));

    for (const rule of promotionConfig.rules) {
      expect(materialIds.has(rule.sealMaterialId)).toBe(true);
      expect(rule.sealQty).toBeGreaterThan(0);
    }
  });

  it("defines provisional data-driven MVP costs for T1 and T2 promotion", () => {
    expect(promotionRuleForTier(1)).toMatchObject({
      sealMaterialId: "promotion_seal_t1",
      sealQty: 1,
      goldCost: 500,
    });
    expect(promotionRuleForTier(2)).toMatchObject({
      sealMaterialId: "promotion_seal_t2",
      sealQty: 2,
      goldCost: 3_000,
    });
  });
});
