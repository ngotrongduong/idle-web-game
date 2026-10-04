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

function findSeed(predicate: (state: ReturnType<typeof refreshWith>) => boolean) {
  for (let seed = 0; seed < 200_000; seed += 1) {
    if (predicate(refreshWith(seed))) return seed;
  }
  throw new Error("no matching seed");
}

describe("tavern refresh", () => {
  it("reads the cooldown and offer count from game-data", () => {
    const state = refreshWith(1);
    expect(TAVERN_REFRESH_MS).toBe(tavernConfig.refreshCooldownSeconds * 1_000);
    expect(state.offers).toHaveLength(tavernConfig.offersPerRefresh);
    expect(state.nextFreeRefreshAt.getTime() - now.getTime()).toBe(TAVERN_REFRESH_MS);
  });

  it("resets rare+ pity when a non-featured offer rolls rare", () => {
    const seed = findSeed(
      (state) =>
        state.offers[0]!.rarity !== "rare" &&
        state.offers[0]!.rarity !== "legendary" &&
        state.offers.slice(1).some((offer) => offer.rarity === "rare") &&
        !state.offers.some((offer) => offer.rarity === "legendary"),
    );
    expect(refreshWith(seed)).toMatchObject({
      refreshesSinceRarePlus: 0,
      refreshesSinceLegendary: 11,
    });
  });

  it("resets both pity counters when a non-featured offer rolls legendary", () => {
    const seed = findSeed(
      (state) =>
        state.offers[0]!.rarity !== "legendary" &&
        state.offers.slice(1).some((offer) => offer.rarity === "legendary"),
    );
    expect(refreshWith(seed)).toMatchObject({
      refreshesSinceRarePlus: 0,
      refreshesSinceLegendary: 0,
    });
  });

  it("keeps counting when no offer reaches the tier", () => {
    const seed = findSeed((state) =>
      state.offers.every((offer) => offer.rarity === "common" || offer.rarity === "elite"),
    );
    expect(refreshWith(seed)).toMatchObject({
      refreshesSinceRarePlus: 11,
      refreshesSinceLegendary: 11,
    });
  });
});
