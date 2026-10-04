import { describe, expect, it } from "vitest";
import rawBuildingsConfig from "../data/buildings.json" with { type: "json" };
import {
  buildingUpgrade,
  buildingsConfig,
  dismantleDustForQuality,
  enhancementDustCost,
  equipmentConfig,
  forgeMaxEnhanceLevel,
  forgeQualityTiers,
  validateBuildingsConfig,
} from "../src/index";

describe("buildings config", () => {
  it("follows the docs/03 §6 Hall curve: 300 × 2.6^(L-1) gold, 60s × 1.9^(L-1)", () => {
    expect(buildingUpgrade("hall", 1)).toEqual({ goldCost: 300, buildSeconds: 60, materials: [] });
    expect(buildingUpgrade("hall", 5)).toMatchObject({ goldCost: 13_710, buildSeconds: 782 });
    expect(buildingUpgrade("hall", 9)).toMatchObject({ goldCost: 626_480, buildSeconds: 10_190 });
    expect(buildingUpgrade("hall", 10)).toBeNull();
  });

  it("prices the Forge at 0.8 × the Hall in gold and time, plus dungeon materials", () => {
    for (let level = 1; level < buildingsConfig.maxLevel; level += 1) {
      const hall = buildingUpgrade("hall", level)!;
      const forge = buildingUpgrade("forge", level)!;
      expect(forge.goldCost).toBe((hall.goldCost * 8) / 10);
      expect(Math.abs(forge.buildSeconds - hall.buildSeconds * 0.8)).toBeLessThanOrEqual(1);
      expect(forge.materials.length).toBeGreaterThan(0);
    }
  });

  it("unlocks enhancement at Forge level 2 and the full +5 at level 5", () => {
    expect(forgeMaxEnhanceLevel(1)).toBe(0);
    expect(forgeMaxEnhanceLevel(2)).toBe(2);
    expect(forgeMaxEnhanceLevel(5)).toBe(equipmentConfig.maxEnhanceLevel);
    expect(forgeMaxEnhanceLevel(10)).toBe(equipmentConfig.maxEnhanceLevel);
  });

  it("shifts craft odds towards better quality with every Forge level", () => {
    expect(forgeQualityTiers(1)).toEqual(equipmentConfig.qualityTiers);
    for (let level = 2; level <= buildingsConfig.maxLevel; level += 1) {
      const previous = forgeQualityTiers(level - 1);
      const current = forgeQualityTiers(level);
      expect(current.reduce((sum, tier) => sum + tier.weightBps, 0)).toBe(10_000);
      expect(current[0]!.weightBps).toBeLessThan(previous[0]!.weightBps);
      for (let tier = 1; tier < current.length; tier += 1) {
        expect(current[tier]!.weightBps).toBeGreaterThan(previous[tier]!.weightBps);
      }
    }
  });

  it("rejects quality weights that do not total 10000 bps", () => {
    const invalid = structuredClone(rawBuildingsConfig);
    invalid.forge.qualityWeightsBps[3] = [6_000, 3_000, 700, 100];
    expect(() => validateBuildingsConfig(invalid)).toThrow("totalling 10000 bps");
  });

  it("rejects an enhancement cap that drops at a higher Forge level", () => {
    const invalid = structuredClone(rawBuildingsConfig);
    invalid.forge.maxEnhanceLevel[4] = 1;
    expect(() => validateBuildingsConfig(invalid)).toThrow("never decrease");
  });

  it("rejects a building with a missing upgrade step", () => {
    const invalid = structuredClone(rawBuildingsConfig);
    invalid.hall.buildSeconds.pop();
    expect(() => validateBuildingsConfig(invalid)).toThrow("hall must list 9 upgrade steps");
  });
});

describe("forge dust", () => {
  it("charges dust for every enhancement attempt", () => {
    expect([0, 1, 2, 3, 4].map(enhancementDustCost)).toEqual([1, 2, 3, 4, 5]);
    expect(() => enhancementDustCost(5)).toThrow("current enhance level");
  });

  it("returns more dust for better craft quality", () => {
    expect(
      equipmentConfig.qualityTiers.map((tier) => dismantleDustForQuality(tier.multiplierBps)),
    ).toEqual([1, 2, 3, 5]);
    // A value between two tiers pays the tier it has reached.
    expect(dismantleDustForQuality(11_500)).toBe(2);
  });
});
