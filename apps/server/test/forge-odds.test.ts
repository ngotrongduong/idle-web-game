import { describe, expect, it } from "vitest";
import { resolveUpgradeAttempt, rollCraftQualityBps, SeededRng } from "@idle/game-core";
import { equipmentConfig } from "@idle/game-data";

// M1.6 acceptance: observed craft/enhance odds must match the docs/03 §5 table and the
// provisional quality tiers recorded in HANDOFF. Seeds are fixed, so these runs are deterministic.
const enhancementRules = {
  successBps: equipmentConfig.enhanceSuccessBps,
  pityStepBps: equipmentConfig.enhancePityStepBps,
  safeLevel: equipmentConfig.maxEnhanceLevel,
};

describe("Forge odds", () => {
  it("rolls craft quality at the configured tier weights", () => {
    const samples = 200_000;
    const rng = new SeededRng(20261004);
    const counts = new Map<number, number>();
    for (let index = 0; index < samples; index += 1) {
      const quality = rollCraftQualityBps(
        rng,
        equipmentConfig.qualityTiers,
        equipmentConfig.baseQualityBps,
      );
      counts.set(quality, (counts.get(quality) ?? 0) + 1);
    }

    expect(equipmentConfig.qualityTiers.map((tier) => tier.weightBps)).toEqual([
      7_000, 2_500, 450, 50,
    ]);
    // GDD §5.6: crafted quality adds +0–30%.
    expect(equipmentConfig.qualityTiers.map((tier) => tier.multiplierBps)).toEqual([
      10_000, 11_000, 12_000, 13_000,
    ]);
    for (const tier of equipmentConfig.qualityTiers) {
      const expected = tier.weightBps / 10_000;
      const observed = (counts.get(tier.multiplierBps) ?? 0) / samples;
      const standardError = Math.sqrt((expected * (1 - expected)) / samples);
      expect(Math.abs(observed - expected)).toBeLessThan(5 * standardError);
    }
  });

  it("matches the documented first-try enhancement odds for +1…+5", () => {
    expect(equipmentConfig.enhanceSuccessBps).toEqual([10_000, 9_500, 9_000, 8_000, 7_000]);
    expect(equipmentConfig.enhancePityStepBps).toBe(500);

    const attempts = 20_000;
    const rng = new SeededRng(42);
    equipmentConfig.enhanceSuccessBps.forEach((successBps, level) => {
      let successes = 0;
      for (let index = 0; index < attempts; index += 1) {
        if (resolveUpgradeAttempt({ level, pityFailures: 0 }, rng, enhancementRules).success) {
          successes += 1;
        }
      }
      const expected = successBps / 10_000;
      const standardError = Math.sqrt((expected * (1 - expected)) / attempts);
      expect(Math.abs(successes / attempts - expected)).toBeLessThanOrEqual(5 * standardError);
    });
  });

  it("reaches +5 in about 5.8 attempts with pity, never dropping a level", () => {
    const journeys = 20_000;
    const rng = new SeededRng(7);
    let totalAttempts = 0;
    for (let journey = 0; journey < journeys; journey += 1) {
      let state = { level: 0, pityFailures: 0 };
      while (state.level < equipmentConfig.maxEnhanceLevel) {
        const result = resolveUpgradeAttempt(state, rng, enhancementRules);
        expect(result.afterLevel).toBeGreaterThanOrEqual(state.level);
        state = { level: result.afterLevel, pityFailures: result.pityFailures };
        totalAttempts += 1;
      }
    }
    const average = totalAttempts / journeys;
    expect(average).toBeGreaterThan(5.7);
    expect(average).toBeLessThan(5.9);
  });
});
