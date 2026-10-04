import { randomBytes, randomUUID } from "node:crypto";
import type { TavernOffer } from "@idle/api-contract";
import {
  rollTavernRarity,
  SeededRng,
  type TavernPityState,
  type TavernRarityRules,
} from "@idle/game-core";
import { foundationGameData, tavernConfig } from "@idle/game-data";
import type { StoredTavernState } from "./store.js";

export const TAVERN_REFRESH_MS = 2 * 60 * 60 * 1_000;

const rarityRules: TavernRarityRules = {
  baseRarityBps: tavernConfig.baseRarityBps,
  rarePityRefreshes: tavernConfig.rarePityRefreshes,
  legendaryPityRefreshes: tavernConfig.legendaryPityRefreshes,
  legendarySoftPityStart: tavernConfig.legendarySoftPityStart,
  legendarySoftPityStepBps: tavernConfig.legendarySoftPityStepBps,
};

const recruitableClassIds = foundationGameData.classes
  .filter((heroClass: { tier: number }) => heroClass.tier === 1)
  .map((heroClass: { id: string }) => heroClass.id);

if (recruitableClassIds.length < 3) {
  throw new Error("Tavern requires at least three recruitable T1 classes");
}

export function emptyTavernState(): StoredTavernState {
  return {
    refreshesSinceRarePlus: 0,
    refreshesSinceLegendary: 0,
    nextFreeRefreshAt: new Date(0),
    offers: [],
  };
}

function createSeed(): number {
  return randomBytes(4).readUInt32LE(0);
}

export function refreshTavernOffers(
  current: StoredTavernState,
  now = new Date(),
  seed = createSeed(),
): StoredTavernState {
  const rng = new SeededRng(seed);
  const pity: TavernPityState = {
    refreshesSinceRarePlus: current.refreshesSinceRarePlus,
    refreshesSinceLegendary: current.refreshesSinceLegendary,
  };
  const featured = rollTavernRarity(rng, pity, rarityRules);
  const availableClasses = [...recruitableClassIds];
  const offers: TavernOffer[] = [];

  for (let index = 0; index < 3; index += 1) {
    const classIndex = rng.nextInt(availableClasses.length);
    const classId = availableClasses.splice(classIndex, 1)[0]!;
    const rarity =
      index === 0
        ? featured.rarity
        : rollTavernRarity(
            rng,
            {
              refreshesSinceRarePlus: 0,
              refreshesSinceLegendary: 0,
            },
            rarityRules,
          ).rarity;

    offers.push({
      id: randomUUID(),
      classId,
      rarity,
    });
  }

  return {
    refreshesSinceRarePlus: featured.nextPity.refreshesSinceRarePlus,
    refreshesSinceLegendary: featured.nextPity.refreshesSinceLegendary,
    nextFreeRefreshAt: new Date(now.getTime() + TAVERN_REFRESH_MS),
    offers,
  };
}

export function serializeTavernState(state: StoredTavernState) {
  return {
    refreshesSinceRarePlus: state.refreshesSinceRarePlus,
    refreshesSinceLegendary: state.refreshesSinceLegendary,
    nextFreeRefreshAt: state.nextFreeRefreshAt.toISOString(),
    offers: state.offers,
  };
}
