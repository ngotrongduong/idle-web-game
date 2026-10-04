import { describe, expect, it } from "vitest";
import { applyHeroExperience, levelCapForTier, xpToNext } from "./progression";

describe("hero EXP progression", () => {
  it("matches the documented XP curve and tier caps", () => {
    expect(xpToNext(1, 1)).toBe(38);
    expect(levelCapForTier(1)).toBe(10);
    expect(levelCapForTier(2)).toBe(20);
    expect(levelCapForTier(3)).toBe(30);
  });

  it("keeps sub-level EXP and levels exactly at the threshold", () => {
    expect(applyHeroExperience({ level: 1, exp: 0, tier: 1 }, 37)).toMatchObject({
      level: 1,
      exp: 37,
      levelsGained: 0,
    });

    expect(applyHeroExperience({ level: 1, exp: 0, tier: 1 }, 38)).toMatchObject({
      level: 2,
      exp: 0,
      levelsGained: 1,
    });
  });

  it("supports multi-level gains while carrying only in-tier remainder", () => {
    const first = xpToNext(1, 1);
    const second = xpToNext(2, 1);
    expect(applyHeroExperience({ level: 1, exp: 0, tier: 1 }, first + second + 5)).toMatchObject({
      level: 3,
      exp: 5,
      levelsGained: 2,
      expDiscarded: 0,
    });
  });

  it("stops at the tier cap and discards over-cap EXP", () => {
    const required = xpToNext(9, 1);
    const result = applyHeroExperience({ level: 9, exp: required - 1, tier: 1 }, 10_000);

    expect(result.level).toBe(10);
    expect(result.exp).toBe(0);
    expect(result.atLevelCap).toBe(true);
    expect(result.expDiscarded).toBeGreaterThan(0);

    expect(applyHeroExperience({ level: 10, exp: 123, tier: 1 }, 999)).toMatchObject({
      level: 10,
      exp: 0,
      levelsGained: 0,
      expDiscarded: 1_122,
      atLevelCap: true,
    });
  });
});
