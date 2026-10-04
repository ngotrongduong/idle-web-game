import { describe, expect, it } from "vitest";
import {
  heroCapacityForHall,
  rollTavernRarity,
  SeededRng,
  type TavernRarityRules,
} from "../src/index";

const rules: TavernRarityRules = {
  baseRarityBps: {
    common: 7_000,
    elite: 2_500,
    rare: 450,
    legendary: 50,
  },
  rarePityRefreshes: 40,
  legendaryPityRefreshes: 200,
  legendarySoftPityStart: 150,
  legendarySoftPityStepBps: 10,
};

describe("tavern recruitment foundation", () => {
  it("derives hero capacity from hall level", () => {
    expect(heroCapacityForHall(1)).toBe(4);
    expect(heroCapacityForHall(10)).toBe(13);
  });

  it("guarantees rare+ on refresh 40 when no rare+ appeared", () => {
    const result = rollTavernRarity(
      new SeededRng(1),
      {
        refreshesSinceRarePlus: 39,
        refreshesSinceLegendary: 39,
      },
      rules,
    );

    expect(result.rarity).toBe("rare");
    expect(result.forcedBy).toBe("rare_pity");
    expect(result.nextPity.refreshesSinceRarePlus).toBe(0);
  });

  it("guarantees legendary on refresh 200", () => {
    const result = rollTavernRarity(
      new SeededRng(1),
      {
        refreshesSinceRarePlus: 5,
        refreshesSinceLegendary: 199,
      },
      rules,
    );

    expect(result.rarity).toBe("legendary");
    expect(result.forcedBy).toBe("legendary_pity");
    expect(result.nextPity).toEqual({
      refreshesSinceRarePlus: 0,
      refreshesSinceLegendary: 0,
    });
  });

  it("increases legendary chance from soft pity refresh 150", () => {
    const before = rollTavernRarity(
      new SeededRng(1),
      {
        refreshesSinceRarePlus: 0,
        refreshesSinceLegendary: 148,
      },
      rules,
    );
    const atSoftPity = rollTavernRarity(
      new SeededRng(1),
      {
        refreshesSinceRarePlus: 0,
        refreshesSinceLegendary: 149,
      },
      rules,
    );

    expect(before.legendaryChanceBps).toBe(50);
    expect(atSoftPity.legendaryChanceBps).toBe(60);
  });
});
