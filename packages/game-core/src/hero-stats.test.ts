import { describe, expect, it } from "vitest";
import {
  HERO_RARITY_MULTIPLIER_BPS,
  calculateHeroStats,
  levelMultiplierBps,
  retainHeroPotential,
} from "./hero-stats";

describe("hero stat progression", () => {
  it("matches the documented quadratic level multiplier", () => {
    expect(levelMultiplierBps(1)).toBe(10_000);
    expect(levelMultiplierBps(10)).toBe(24_040);
    expect(levelMultiplierBps(20)).toBe(47_240);
  });

  it("retains a basis-point share of pre-promotion combat stats", () => {
    expect(
      retainHeroPotential(
        { hp: 504, attack: 81, defense: 76, speed: 21 },
        2_000,
      ),
    ).toEqual({
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
