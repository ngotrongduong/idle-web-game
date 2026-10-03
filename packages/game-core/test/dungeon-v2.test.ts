import { describe, expect, it } from "vitest";
import {
  simulateDungeonRunV2,
  simulateWaveV2,
  type CombatantV2,
  type DungeonWaveV2,
} from "../src/index";

describe("dungeon battle v2", () => {
  const allies: CombatantV2[] = [
    {
      id: "hero",
      hp: 1000,
      attack: 200,
      defense: 10,
      speed: 5,
      critBps: 0,
    },
  ];

  const waves: DungeonWaveV2[] = [
    {
      id: "wave_1",
      enemies: [
        {
          id: "enemy_1",
          hp: 100,
          attack: 25,
          defense: 5,
          speed: 10,
          critBps: 0,
        },
      ],
    },
    {
      id: "wave_2",
      enemies: [
        {
          id: "enemy_2",
          hp: 100,
          attack: 25,
          defense: 5,
          speed: 10,
          critBps: 0,
        },
      ],
    },
  ];

  it("carries ally HP, MP and shield state between waves", () => {
    const run = simulateDungeonRunV2({
      allies,
      waves,
      seed: 7,
      rules: { maxTurns: 20 },
    });

    expect(run.result).toBe("win");
    expect(run.wavesCleared).toBe(2);
    expect(run.waveResults).toHaveLength(2);

    const second = run.waveResults[1]!;
    const resetSecondWave = simulateWaveV2({
      allies,
      enemies: waves[1]!.enemies,
      seed: second.seed,
      rules: { maxTurns: 20 },
    });

    expect(run.finalAllies[0]!.currentHp).toBeLessThan(
      resetSecondWave.finalAllies[0]!.currentHp,
    );
  });

  it("replays the whole dungeon identically for the same seed", () => {
    const input = {
      allies,
      waves,
      seed: 99,
      rules: { maxTurns: 20 },
    };

    expect(simulateDungeonRunV2(input)).toEqual(
      simulateDungeonRunV2(input),
    );
    expect(simulateDungeonRunV2(input).hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("stops after the first failed wave", () => {
    const result = simulateDungeonRunV2({
      allies: [
        {
          id: "weak_hero",
          hp: 50,
          attack: 5,
          defense: 0,
          speed: 1,
          critBps: 0,
        },
      ],
      waves: [
        {
          id: "wall",
          enemies: [
            {
              id: "boss",
              hp: 500,
              attack: 100,
              defense: 50,
              speed: 20,
              critBps: 0,
            },
          ],
        },
        {
          id: "never_reached",
          enemies: [
            {
              id: "next",
              hp: 10,
              attack: 1,
              defense: 0,
              speed: 1,
              critBps: 0,
            },
          ],
        },
      ],
      seed: 1,
    });

    expect(result.result).toBe("lose");
    expect(result.wavesAttempted).toBe(1);
    expect(result.wavesCleared).toBe(0);
  });
});
