import { describe, expect, it } from "vitest";
import {
  HERO_RARITY_MULTIPLIER_BPS,
  calculateHeroStats,
  combatLevel,
  levelMultiplierBps,
  progressionHundredths,
  tierLevelMultiplierBps,
  retainHeroPotential,
} from "./hero-stats";

describe("hero stat progression", () => {
  it("matches the documented quadratic level multiplier", () => {
    expect(levelMultiplierBps(1)).toBe(10_000);
    expect(levelMultiplierBps(10)).toBe(24_040);
    expect(levelMultiplierBps(20)).toBe(47_240);
  });

  it("continues the level multiplier across tiers instead of resetting to x1.00", () => {
    expect(tierLevelMultiplierBps(1, 10)).toBe(levelMultiplierBps(10));
    expect(tierLevelMultiplierBps(2, 1)).toBe(24_040);
    expect(tierLevelMultiplierBps(2, 20)).toBe(47_240);
    expect(tierLevelMultiplierBps(3, 1)).toBe(47_240);
    expect(tierLevelMultiplierBps(3, 30)).toBe(78_440);
    for (let tier = 1; tier <= 3; tier += 1) {
      for (let level = 2; level <= 10 * tier; level += 1) {
        expect(tierLevelMultiplierBps(tier, level)).toBeGreaterThanOrEqual(
          tierLevelMultiplierBps(tier, level - 1),
        );
      }
    }
    expect(progressionHundredths(2, 20)).toBe(1_900);
    expect(() => progressionHundredths(1, 11)).toThrow();
  });

  it("maps tier levels onto one 1–30 combat level scale", () => {
    expect([combatLevel(1, 1), combatLevel(1, 10)]).toEqual([1, 10]);
    expect([combatLevel(2, 1), combatLevel(2, 20)]).toEqual([10, 20]);
    expect([combatLevel(3, 1), combatLevel(3, 30)]).toEqual([20, 30]);
  });

  it("retains a basis-point share of pre-promotion combat stats", () => {
    expect(retainHeroPotential({ hp: 504, attack: 81, defense: 76, speed: 21 }, 2_000)).toEqual({
      hp: 100,
      attack: 16,
      defense: 15,
      speed: 4,
    });
  });

  it("applies rarity and retained potential with integer math", () => {
    expect(HERO_RARITY_MULTIPLIER_BPS.rare).toBe(11_800);

    expect(
      calculateHeroStats({
        baseHp: 210,
        baseAttack: 34,
        baseDefense: 32,
        baseSpeed: 9,
        level: 10,
        rarity: "rare",
        potential: {
          hp: 25,
          attack: 4,
          defense: 3,
          speed: 1,
        },
      }),
    ).toEqual({
      hp: 620,
      attack: 100,
      defense: 93,
      speed: 26,
    });
  });
});
