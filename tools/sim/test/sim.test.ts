import { describe, expect, it } from "vitest";
import { GAME_CORE_VERSION, simulateWave } from "@idle/game-core";
import { foundationGameData } from "@idle/game-data";
import { runBattleSimulation } from "../src/battle-sim";
import {
  buildDungeonWave,
  buildProgressionTeam,
  SAMPLE_ENCOUNTERS,
} from "../src/scenarios";
import { runUpgradeSimulation } from "../src/upgrade-sim";

describe("sim tools", () => {
  it("depends on the command-ready shared game-core package", () => {
    expect(GAME_CORE_VERSION).toBe("m0.6a-command-ready");
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

  it("builds a four-member progression team from class config", () => {
    const team = buildProgressionTeam(20);
    expect(team).toHaveLength(4);
    expect(new Set(team.map((unit) => unit.id)).size).toBe(4);
  });

  it("generates boss wave 6 from dungeon enemy config", () => {
    const dungeon = foundationGameData.dungeons[0]!;
    const wave = buildDungeonWave(dungeon.id, dungeon.waveCount);
    expect(wave.enemies).toHaveLength(1);
    const enemy = foundationGameData.enemies.find(
      (entry) => entry.id === wave.enemies[0]!.id,
    );
    expect(enemy?.rank).toBe("boss");
    expect(wave.rewardGold).toBeGreaterThan(0);
    expect(wave.rewardExp).toBeGreaterThan(0);
  });

  it("summarizes all four data-driven dungeon encounters", () => {
    expect(SAMPLE_ENCOUNTERS).toHaveLength(4);
    const summaries = runBattleSimulation({ runs: 10, seedBase: 10 });
    expect(summaries).toHaveLength(4);
    expect(summaries.every((summary) => summary.runs === 10)).toBe(true);
    expect(
      summaries.every(
        (summary) => summary.wins + summary.losses + summary.draws === 10,
      ),
    ).toBe(true);
    expect(
      summaries.every(
        (summary) => summary.expectedGold >= 0 && summary.expectedExp >= 0,
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
