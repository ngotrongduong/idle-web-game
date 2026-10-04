import { describe, expect, it } from "vitest";
import { tavernConfig } from "@idle/game-data";
import { emptyTavernState, refreshTavernOffers, TAVERN_REFRESH_MS } from "../src/tavern.js";

const now = new Date("2026-10-04T00:00:00.000Z");

function refreshWith(seed: number) {
  return refreshTavernOffers(
    { ...emptyTavernState(), refreshesSinceRarePlus: 10, refreshesSinceLegendary: 10 },
    now,
    seed,
  );
}

describe("tavern refresh", () => {
  it("reads the cooldown and offer count from game-data", () => {
    const state = refreshWith(1);
    expect(TAVERN_REFRESH_MS).toBe(tavernConfig.refreshCooldownSeconds * 1_000);
    expect(state.offers).toHaveLength(tavernConfig.offersPerRefresh);
    expect(state.nextFreeRefreshAt.getTime() - now.getTime()).toBe(TAVERN_REFRESH_MS);
  });

  it("only lets the featured offer roll rare or legendary", () => {
    for (let seed = 0; seed < 20_000; seed += 1) {
      const secondary = refreshWith(seed).offers.slice(1);
      expect(
        secondary.every((offer) => offer.rarity === "common" || offer.rarity === "elite"),
      ).toBe(true);
    }
  });

  it("contains a rare+ hero once per 20 refreshes before pity, ~1 per 17 with it (docs/03 §7)", () => {
    const refreshes = 120_000;
    let state = emptyTavernState();
    let withRarePlus = 0;
    let longestDrought = 0;
    for (let index = 0; index < refreshes; index += 1) {
      state = refreshTavernOffers(state, now, (Math.imul(index, 2654435761) + 17) >>> 0);
      if (state.offers.some((offer) => offer.rarity === "rare" || offer.rarity === "legendary")) {
        withRarePlus += 1;
      }
      longestDrought = Math.max(longestDrought, state.refreshesSinceRarePlus);
    }

    // Base rare+ is 5%; hard pity at 40 makes the mean wait (1 - 0.95^40) / 0.05 ≈ 17.4 refreshes,
    // i.e. ≈5.7%, plus a little from legendary soft pity.
    const rate = withRarePlus / refreshes;
    expect(rate).toBeGreaterThan(0.055);
    expect(rate).toBeLessThan(0.063);
    expect(longestDrought).toBeLessThan(tavernConfig.rarePityRefreshes);
  });

  it("advances pity from the featured roll only", () => {
    const state = refreshWith(3);
    const featured = state.offers[0]!.rarity;
    if (featured === "legendary") {
      expect(state).toMatchObject({ refreshesSinceRarePlus: 0, refreshesSinceLegendary: 0 });
    } else if (featured === "rare") {
      expect(state).toMatchObject({ refreshesSinceRarePlus: 0, refreshesSinceLegendary: 11 });
    } else {
      expect(state).toMatchObject({ refreshesSinceRarePlus: 11, refreshesSinceLegendary: 11 });
    }
  });
});
