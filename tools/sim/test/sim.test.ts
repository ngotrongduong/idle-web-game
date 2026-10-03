import { describe, expect, it } from "vitest";
import {
  GAME_CORE_VERSION,
  simulateWave,
  simulateWaveV2,
} from "@idle/game-core";
import { foundationGameData } from "@idle/game-data";
import { runBattleSimulation } from "../src/battle-sim";
import {
  runDungeonSimulation,
  SAMPLE_DUNGEONS,
} from "../src/dungeon-sim";
import { SAMPLE_ENCOUNTERS, SAMPLE_TEAM } from "../src/scenarios";
import { runUpgradeSimulation } from "../src/upgrade-sim";

describe("sim tools", () => {
  it("depends on battle rules v2", () => {
    expect(GAME_CORE_VERSION).toBe("m0-battle-v2");
  });

  it("keeps the legacy deterministic wave available", () => {
    const result = simulateWave({
      seed: 5,
      allies: [{ id: "hero", hp: 100, attack: 30, defense: 10, speed: 10 }],
      enemies: [{ id: "mob", hp: 30, attack: 10, defense: 5, speed: 5 }],
    });

    expect(result.result).toBe("win");
    expect(result.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("derives team skills/passives and encounters from game-data", () => {
    expect(SAMPLE_TEAM.every((entry) => entry.ult && entry.passive)).toBe(true);
    expect(SAMPLE_ENCOUNTERS.map((entry) => entry.id)).toEqual(
      foundationGameData.dungeons.map((entry) => entry.id),
    );

    for (const encounter of SAMPLE_ENCOUNTERS) {
      expect(encounter.enemies).toHaveLength(3);
    }
  });

  it("runs configured ULT actions when a fight lasts long enough", () => {
    const result = simulateWaveV2({
      seed: 10,
      allies: SAMPLE_TEAM,
      enemies: [
        {
          id: "training_wall",
          hp: 10_000,
          attack: 1,
          defense: 100,
          speed: 1,
          critBps: 0,
        },
      ],
      rules: { maxTurns: 60 },
    });

    expect(result.rulesVersion).toBe("v2");
    expect(
      result.events.some((event) => event.action !== "basic_attack"),
    ).toBe(true);
  });

  it("summarizes all four MVP encounters with v2", () => {
    const summaries = runBattleSimulation({ runs: 10, seedBase: 10 });
    expect(summaries).toHaveLength(4);
    expect(summaries.every((summary) => summary.rulesVersion === "v2")).toBe(
      true,
    );
    expect(summaries.every((summary) => summary.runs === 10)).toBe(true);
    expect(
      summaries.every(
        (summary) => summary.wins + summary.losses + summary.draws === 10,
      ),
    ).toBe(true);
  });

  it("builds and simulates all four configured six-wave dungeons", () => {
    expect(SAMPLE_DUNGEONS).toHaveLength(4);
    expect(SAMPLE_DUNGEONS.every((dungeon) => dungeon.waves.length === 6)).toBe(
      true,
    );

    const summaries = runDungeonSimulation({ runs: 3, seedBase: 1 });
    expect(summaries).toHaveLength(4);
    expect(
      summaries.every(
        (summary) =>
          summary.completions >= 0 &&
          summary.completions <= summary.runs &&
          summary.averageWavesCleared >= 0 &&
          summary.averageWavesCleared <= 6,
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
