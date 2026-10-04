import { simulateUpgradeJourney, UPGRADE_MAX_LEVEL } from "@idle/game-core";
import { mean, percentile } from "./stats";

export type UpgradeSimulationSummary = {
  runs: number;
  targetLevel: number;
  completed: number;
  completionRate: number;
  meanAttempts: number;
  p50Attempts: number;
  p90Attempts: number;
  p99Attempts: number;
  meanFailures: number;
};

export function runUpgradeSimulation(input: {
  runs: number;
  targetLevel?: number;
  seedBase?: number;
}): UpgradeSimulationSummary {
  if (!Number.isInteger(input.runs) || input.runs <= 0) {
    throw new Error("runs must be a positive integer");
  }

  const targetLevel = input.targetLevel ?? UPGRADE_MAX_LEVEL;
  const seedBase = input.seedBase ?? 1;
  const attempts: number[] = [];
  const failures: number[] = [];
  let completed = 0;

  for (let run = 0; run < input.runs; run += 1) {
    const result = simulateUpgradeJourney({
      seed: seedBase + run,
      targetLevel,
    });

    attempts.push(result.attempts);
    failures.push(result.failures);
    if (result.completed) completed += 1;
  }

  return {
    runs: input.runs,
    targetLevel,
    completed,
    completionRate: completed / input.runs,
    meanAttempts: mean(attempts),
    p50Attempts: percentile(attempts, 0.5),
    p90Attempts: percentile(attempts, 0.9),
    p99Attempts: percentile(attempts, 0.99),
    meanFailures: mean(failures),
  };
}
