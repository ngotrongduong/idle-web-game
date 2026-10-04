import { SeededRng } from "./rng.js";

export type HeroRarity = "common" | "elite" | "rare" | "legendary";

export type TavernRarityRules = {
  baseRarityBps: Record<HeroRarity, number>;
  rarePityRefreshes: number;
  legendaryPityRefreshes: number;
  legendarySoftPityStart: number;
  legendarySoftPityStepBps: number;
};

export type TavernPityState = {
  refreshesSinceRarePlus: number;
  refreshesSinceLegendary: number;
};

export type TavernRarityRoll = {
  rarity: HeroRarity;
  nextPity: TavernPityState;
  legendaryChanceBps: number;
  forcedBy?: "rare_pity" | "legendary_pity";
};

const BPS = 10_000;

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function legendaryChanceBps(
  state: TavernPityState,
  rules: TavernRarityRules,
): number {
  const attempt = state.refreshesSinceLegendary + 1;
  const softSteps = Math.max(0, attempt - rules.legendarySoftPityStart + 1);
  return Math.min(
    BPS,
    rules.baseRarityBps.legendary +
      softSteps * rules.legendarySoftPityStepBps,
  );
}

function nextPityState(
  state: TavernPityState,
  rarity: HeroRarity,
): TavernPityState {
  if (rarity === "legendary") {
    return {
      refreshesSinceRarePlus: 0,
      refreshesSinceLegendary: 0,
    };
  }

  if (rarity === "rare") {
    return {
      refreshesSinceRarePlus: 0,
      refreshesSinceLegendary: state.refreshesSinceLegendary + 1,
    };
  }

  return {
    refreshesSinceRarePlus: state.refreshesSinceRarePlus + 1,
    refreshesSinceLegendary: state.refreshesSinceLegendary + 1,
  };
}

export function rollTavernRarity(
  rng: SeededRng,
  state: TavernPityState,
  rules: TavernRarityRules,
): TavernRarityRoll {
  assertNonNegativeInteger(
    state.refreshesSinceRarePlus,
    "refreshesSinceRarePlus",
  );
  assertNonNegativeInteger(
    state.refreshesSinceLegendary,
    "refreshesSinceLegendary",
  );

  const legendaryAttempt = state.refreshesSinceLegendary + 1;
  if (legendaryAttempt >= rules.legendaryPityRefreshes) {
    const rarity: HeroRarity = "legendary";
    return {
      rarity,
      nextPity: nextPityState(state, rarity),
      legendaryChanceBps: BPS,
      forcedBy: "legendary_pity",
    };
  }

  const legendaryBps = legendaryChanceBps(state, rules);
  const roll = rng.nextInt(BPS);

  if (roll < legendaryBps) {
    const rarity: HeroRarity = "legendary";
    return {
      rarity,
      nextPity: nextPityState(state, rarity),
      legendaryChanceBps: legendaryBps,
    };
  }

  const rareAttempt = state.refreshesSinceRarePlus + 1;
  if (rareAttempt >= rules.rarePityRefreshes) {
    const rarity: HeroRarity = "rare";
    return {
      rarity,
      nextPity: nextPityState(state, rarity),
      legendaryChanceBps: legendaryBps,
      forcedBy: "rare_pity",
    };
  }

  const rareUpper = legendaryBps + rules.baseRarityBps.rare;
  if (roll < rareUpper) {
    const rarity: HeroRarity = "rare";
    return {
      rarity,
      nextPity: nextPityState(state, rarity),
      legendaryChanceBps: legendaryBps,
    };
  }

  const eliteUpper = rareUpper + rules.baseRarityBps.elite;
  const rarity: HeroRarity = roll < eliteUpper ? "elite" : "common";
  return {
    rarity,
    nextPity: nextPityState(state, rarity),
    legendaryChanceBps: legendaryBps,
  };
}

