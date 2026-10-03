import { simulateWaveV2 } from "@idle/game-core";
import { SAMPLE_ENCOUNTERS, SAMPLE_TEAM } from "./scenarios";
import { mean, percentile } from "./stats";

export type BattleSimulationSummary = {
  rulesVersion: "v2";
  encounterId: string;
  label: string;
  runs: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  averageTurns: number;
  p50Turns: number;
  p90Turns: number;
  averageUltActions: number;
};

export function runBattleSimulation(input: {
  runs: number;
  seedBase?: number;
  encounterId?: string;
}): BattleSimulationSummary[] {
  if (!Number.isInteger(input.runs) || input.runs <= 0) {
    throw new Error("runs must be a positive integer");
  }

  const seedBase = input.seedBase ?? 1;
  const encounters = input.encounterId
    ? SAMPLE_ENCOUNTERS.filter(
        (encounter) => encounter.id === input.encounterId,
      )
    : SAMPLE_ENCOUNTERS;

  if (encounters.length === 0) {
    throw new Error(`unknown encounter: ${input.encounterId}`);
  }

  return encounters.map((encounter, encounterIndex) => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    const turns: number[] = [];
    const ultActions: number[] = [];

    for (let run = 0; run < input.runs; run += 1) {
      const result = simulateWaveV2({
        allies: SAMPLE_TEAM,
        enemies: encounter.enemies,
        seed: seedBase + encounterIndex * 1_000_000 + run,
      });

      turns.push(result.turns);
      ultActions.push(
        new Set(
          result.events
            .filter((event) => event.action !== "basic_attack")
            .map((event) => `${event.turn}:${event.actorId}`),
        ).size,
      );

      if (result.result === "win") wins += 1;
      else if (result.result === "lose") losses += 1;
      else draws += 1;
    }

    return {
      rulesVersion: "v2",
      encounterId: encounter.id,
      label: encounter.label,
      runs: input.runs,
      wins,
      losses,
      draws,
      winRate: wins / input.runs,
      averageTurns: mean(turns),
      p50Turns: percentile(turns, 0.5),
      p90Turns: percentile(turns, 0.9),
      averageUltActions: mean(ultActions),
    };
  });
}
