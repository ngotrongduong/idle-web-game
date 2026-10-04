import { describe, expect, it } from "vitest";
import { TavernConfigSchema, tavernConfig } from "../src/index";

describe("tavern config", () => {
  it("keeps documented base rarity rates in data", () => {
    expect(tavernConfig.baseRarityBps).toEqual({
      common: 7_000,
      elite: 2_500,
      rare: 450,
      legendary: 50,
    });
    expect(tavernConfig.rarePityRefreshes).toBe(40);
    expect(tavernConfig.legendaryPityRefreshes).toBe(200);
  });

  it("keeps rarity stat multipliers in game-data", () => {
    expect(tavernConfig.rarityStatMultiplierBps).toEqual({
      common: 10_000,
      elite: 10_800,
      rare: 11_800,
      legendary: 13_000,
    });
  });

  it("keeps the non-featured offers to common/elite", () => {
    expect(tavernConfig.secondaryOfferRarityBps).toEqual({
      common: 7_368,
      elite: 2_632,
      rare: 0,
      legendary: 0,
    });
    expect(() =>
      TavernConfigSchema.parse({
        ...tavernConfig,
        secondaryOfferRarityBps: { common: 7_000, elite: 2_500, rare: 450, legendary: 50 },
      }),
    ).toThrow("secondary offers must not roll rare or legendary");
  });

  it("rejects rarity probabilities that do not total 10000 bps", () => {
    expect(() =>
      TavernConfigSchema.parse({
        ...tavernConfig,
        baseRarityBps: {
          ...tavernConfig.baseRarityBps,
          common: 6_999,
        },
      }),
    ).toThrow("base rarity probabilities must total 10000 bps");
  });
});
