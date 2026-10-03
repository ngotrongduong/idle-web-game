import { describe, expect, it } from "vitest";
import {
  simulateWave,
  simulateWaveV2,
  type CombatantV2,
} from "../src/index";

describe("battle rules v2", () => {
  it("keeps the v1 golden replay unchanged", () => {
    const battle = simulateWave({
      seed: 123456,
      allies: [
        {
          id: "warrior",
          hp: 180,
          attack: 42,
          defense: 28,
          speed: 12,
          critBps: 1000,
        },
        {
          id: "mage",
          hp: 110,
          attack: 55,
          defense: 12,
          speed: 15,
          critBps: 1400,
        },
      ],
      enemies: [
        {
          id: "slime_a",
          hp: 95,
          attack: 25,
          defense: 10,
          speed: 8,
          critBps: 500,
        },
        {
          id: "slime_b",
          hp: 105,
          attack: 27,
          defense: 12,
          speed: 9,
          critBps: 500,
        },
      ],
    });

    expect(battle.hash).toBe("c080875a");
  });

  it("has a deterministic v2 replay with MP, damage ULT and healing ULT", () => {
    const allies: CombatantV2[] = [
      {
        id: "blade",
        hp: 500,
        attack: 30,
        defense: 10,
        speed: 10,
        critBps: 0,
        passive: { stat: "attack", bonusBps: 1000 },
        ult: {
          id: "burst",
          effect: "damage_single",
          target: "lowest_hp_enemy",
          powerBps: 20_000,
        },
      },
      {
        id: "medic",
        hp: 400,
        attack: 20,
        defense: 15,
        speed: 8,
        critBps: 0,
        passive: { stat: "hp", bonusBps: 1000 },
        ult: {
          id: "mend",
          effect: "heal_aoe",
          target: "all_allies",
          powerBps: 10_000,
        },
      },
    ];

    const battle = simulateWaveV2({
      seed: 123,
      allies,
      enemies: [
        { id: "x", hp: 400, attack: 20, defense: 10, speed: 7, critBps: 0 },
        { id: "y", hp: 400, attack: 20, defense: 10, speed: 6, critBps: 0 },
      ],
      rules: { maxTurns: 60 },
    });

    expect(battle.rulesVersion).toBe("v2");
    expect(battle.result).toBe("draw");
    expect(battle.turns).toBe(60);
    expect(battle.events.some((event) => event.action === "ult_damage")).toBe(
      true,
    );
    expect(battle.events.some((event) => event.action === "ult_heal")).toBe(
      true,
    );
    expect(battle.hash).toBe("72445318");
  });

  it("replays v2 identically for the same seed", () => {
    const input = {
      seed: 55,
      allies: [
        {
          id: "shield",
          hp: 180,
          attack: 30,
          defense: 25,
          speed: 10,
          ult: {
            id: "aegis",
            effect: "shield_allies" as const,
            target: "all_allies" as const,
            powerBps: 10_000,
          },
        },
      ],
      enemies: [
        { id: "mob", hp: 250, attack: 22, defense: 10, speed: 9 },
      ],
      rules: { maxTurns: 40 },
    };

    expect(simulateWaveV2(input)).toEqual(simulateWaveV2(input));
  });
});
