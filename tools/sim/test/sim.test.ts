import { describe, expect, it } from "vitest";
import { GAME_CORE_VERSION, simulateWave } from "@idle/game-core";
import { foundationGameData } from "@idle/game-data";
import { runBattleSimulation } from "../src/battle-sim";
import { runEconomySimulation } from "../src/economy-sim";
import { runGachaSimulation } from "../src/gacha-sim";
import { buildDungeonWave, buildProgressionTeam, SAMPLE_ENCOUNTERS } from "../src/scenarios";
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
    const enemy = foundationGameData.enemies.find((entry) => entry.id === wave.enemies[0]!.id);
    expect(enemy?.rank).toBe("boss");
    expect(wave.rewardGold).toBeGreaterThan(0);
    expect(wave.rewardExp).toBeGreaterThan(0);
  });

  it("summarizes all four data-driven dungeon encounters", () => {
    expect(SAMPLE_ENCOUNTERS).toHaveLength(4);
    const summaries = runBattleSimulation({ runs: 10, seedBase: 10 });
    expect(summaries).toHaveLength(4);
    expect(summaries.every((summary) => summary.runs === 10)).toBe(true);
    expect(summaries.every((summary) => summary.wins + summary.losses + summary.draws === 10)).toBe(
      true,
    );
    expect(
      summaries.every((summary) => summary.expectedGold >= 0 && summary.expectedExp >= 0),
    ).toBe(true);
  });

  it("keeps tavern pity within the configured hard limits", () => {
    const summary = runGachaSimulation({ runs: 1_000, seedBase: 1 });

    expect(summary.maxRefreshesToRarePlus).toBeLessThanOrEqual(40);
    expect(summary.maxRefreshesToLegendary).toBeLessThanOrEqual(200);
    expect(summary.p90RefreshesToLegendary).toBeGreaterThanOrEqual(summary.p90RefreshesToRarePlus);
  });

  it("summarizes the combined economy from production config", () => {
    const summary = runEconomySimulation();

    expect(summary.dungeons).toHaveLength(4);
    expect(summary.dungeons[0]?.passiveCapCycles).toBe(450);
    expect(summary.dungeons.every((dungeon) => dungeon.onlineGoldPerHour > 0)).toBe(true);
    expect(summary.recipes.length).toBeGreaterThan(0);
    expect(summary.recipes.every((recipe) => recipe.baseSellGold > 0)).toBe(true);
    expect(summary.enhancement.targetLevel).toBe(5);
    expect(summary.enhancement.expectedGold).toBeGreaterThan(0);
    expect(
      summary.dungeons.every(
        (dungeon) =>
          dungeon.targetDeviationRatio === null || Math.abs(dungeon.targetDeviationRatio) <= 0.2,
      ),
    ).toBe(true);
    expect(summary.recipes[0]?.expectedOnlineMinutes).toBeLessThanOrEqual(3.6);
    expect(summary.warnings).toEqual(["craft_gold_sink_disabled: craftGoldCost=0"]);
  });

  it("keeps building and Forge Dust pacing inside the docs/03 targets", () => {
    const { buildings, enhancement } = runEconomySimulation();

    // docs/03 §6: 300 × 2.6^(L-1) gold summed over nine Hall upgrades, Forge at 0.8×.
    expect(buildings.hall.totalGold).toBe(1_017_830);
    expect(buildings.forge.totalGold).toBe(814_264);
    expect(buildings.hall.longestBuildMinutes).toBeCloseTo(169.83, 1);

    // docs/03 §4: a second team by minute 6, with the Hall as the first gold priority.
    expect(buildings.teamTwo.hallLevel).toBe(3);
    expect(buildings.teamTwo.minutes).toBeLessThanOrEqual(buildings.teamTwo.targetMinutes);

    // +5 takes ≈5.8 attempts; dust costs 1..5 put the journey at roughly 20 dismantled items.
    expect(enhancement.forgeLevelRequired).toBe(5);
    expect(enhancement.expectedDust).toBeGreaterThan(15);
    expect(enhancement.expectedDust).toBeLessThan(25);
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
