import { describe, expect, it } from "vitest";
import { GAME_CORE_VERSION, simulateWave } from "@idle/game-core";
import { runBattleSimulation } from "../src/battle-sim";
import { runUpgradeSimulation } from "../src/upgrade-sim";

describe("sim tools", () => {
  it("depends on the simulation-ready shared game-core package", () => {
    expect(GAME_CORE_VERSION).toBe("m0.5-simulation-ready");
  });

  it("can run a tiny deterministic wave", () => {
    const result = simulateWave({
      seed: 5,
      allies: [{ id: "hero", hp: 100, attack: 30, defense: 10, speed: 10 }],
      enemies: [{ id: "mob", hp: 30, attack: 10, defense: 5, speed: 5 }],
    });

    expect(result.result).toBe("win");
    expect(result.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("summarizes all four sample encounters", () => {
    const summaries = runBattleSimulation({ runs: 10, seedBase: 10 });
    expect(summaries).toHaveLength(4);
    expect(summaries.every((summary) => summary.runs === 10)).toBe(true);
    expect(
      summaries.every(
        (summary) => summary.wins + summary.losses + summary.draws === 10,
      ),
    ).toBe(true);
  });

  it("summarizes upgrade percentiles", () => {
    const summary = runUpgradeSimulation({
      runs: 100,
      targetLevel: 10,
      seedBase: 1,
    });

    expect(summary.completed).toBe(100);
    expect(summary.p90Attempts).toBeGreaterThanOrEqual(summary.p50Attempts);
    expect(summary.p99Attempts).toBeGreaterThanOrEqual(summary.p90Attempts);
  });
});
