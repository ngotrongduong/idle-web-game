import {
  rollTavernRarity,
  SeededRng,
  type TavernPityState,
  type TavernRarityRules,
} from "@idle/game-core";
import { tavernConfig } from "@idle/game-data";
import { mean, percentile } from "./stats";

const rules: TavernRarityRules = {
  baseRarityBps: tavernConfig.baseRarityBps,
  rarePityRefreshes: tavernConfig.rarePityRefreshes,
  legendaryPityRefreshes: tavernConfig.legendaryPityRefreshes,
  legendarySoftPityStart: tavernConfig.legendarySoftPityStart,
  legendarySoftPityStepBps: tavernConfig.legendarySoftPityStepBps,
};

export type GachaSimulationSummary = {
  runs: number;
  averageRefreshesToRarePlus: number;
  p90RefreshesToRarePlus: number;
  maxRefreshesToRarePlus: number;
  averageRefreshesToLegendary: number;
  p90RefreshesToLegendary: number;
  p99RefreshesToLegendary: number;
  maxRefreshesToLegendary: number;
};

export function runGachaSimulation(input: {
  runs: number;
  seedBase?: number;
}): GachaSimulationSummary {
  if (!Number.isInteger(input.runs) || input.runs <= 0) {
    throw new Error("runs must be a positive integer");
  }

  const seedBase = input.seedBase ?? 1;
  const rarePlusRefreshes: number[] = [];
  const legendaryRefreshes: number[] = [];

  for (let run = 0; run < input.runs; run += 1) {
    const rng = new SeededRng(seedBase + run);
    let pity: TavernPityState = {
      refreshesSinceRarePlus: 0,
      refreshesSinceLegendary: 0,
    };
    let firstRarePlus: number | undefined;

    for (let refresh = 1; refresh <= rules.legendaryPityRefreshes; refresh += 1) {
      const result = rollTavernRarity(rng, pity, rules);
      pity = result.nextPity;

      if (
        firstRarePlus === undefined &&
        (result.rarity === "rare" || result.rarity === "legendary")
      ) {
        firstRarePlus = refresh;
      }

      if (result.rarity === "legendary") {
        rarePlusRefreshes.push(firstRarePlus ?? refresh);
        legendaryRefreshes.push(refresh);
        break;
      }
    }
  }

  if (rarePlusRefreshes.length !== input.runs || legendaryRefreshes.length !== input.runs) {
    throw new Error("pity guarantees were not satisfied in every simulation");
  }

  return {
    runs: input.runs,
    averageRefreshesToRarePlus: mean(rarePlusRefreshes),
    p90RefreshesToRarePlus: percentile(rarePlusRefreshes, 0.9),
    maxRefreshesToRarePlus: Math.max(...rarePlusRefreshes),
    averageRefreshesToLegendary: mean(legendaryRefreshes),
    p90RefreshesToLegendary: percentile(legendaryRefreshes, 0.9),
    p99RefreshesToLegendary: percentile(legendaryRefreshes, 0.99),
    maxRefreshesToLegendary: Math.max(...legendaryRefreshes),
  };
}
