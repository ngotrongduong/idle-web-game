import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  clampInt,
  GAME_CORE_VERSION,
  scaleStat,
  SeededRng,
  simulateWave,
} from "../src/index";

describe("game-core foundation", () => {
  it("exports the command-ready milestone version", () => {
    expect(GAME_CORE_VERSION).toBe("m0.6a-command-ready");
  });

  it("keeps integer values inside bounds", () => {
    expect(clampInt(11.8, 0, 10)).toBe(10);
    expect(clampInt(-2, 0, 10)).toBe(0);
    expect(clampInt(5.9, 0, 10)).toBe(5);
  });

  it("scales stats with integer basis points", () => {
    expect(scaleStat(100, 1, 500)).toBe(100);
    expect(scaleStat(100, 3, 500)).toBe(110);
  });

  it("has stable seeded RNG output", () => {
    const rng = new SeededRng(1);
    expect(Array.from({ length: 5 }, () => rng.nextUint32())).toEqual([
      2693262067,
      11749833,
      2265367787,
      4213581821,
      4159151403,
    ]);
  });

  it("matches the golden battle hash", () => {
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

    expect(battle.result).toBe("win");
    expect(battle.turns).toBe(8);
    expect(battle.hash).toBe("c080875a");
  });

  it("keeps the legacy golden hash when optional battle features are unused", () => {
    const battle = simulateWave({
      seed: 123456,
      allies: [
        { id: "warrior", hp: 180, attack: 42, defense: 28, speed: 12, critBps: 1000 },
        { id: "mage", hp: 110, attack: 55, defense: 12, speed: 15, critBps: 1400 },
      ],
      enemies: [
        { id: "slime_a", hp: 95, attack: 25, defense: 10, speed: 8, critBps: 500 },
        { id: "slime_b", hp: 105, attack: 27, defense: 12, speed: 9, critBps: 500 },
      ],
    });
    expect(battle.hash).toBe("c080875a");
  });

  it("uses an ultimate when MP is full", () => {
    const battle = simulateWave({
      seed: 1,
      allies: [{
        id: "caster",
        hp: 100,
        attack: 40,
        defense: 10,
        speed: 20,
        critBps: 0,
        ultimatePowerBps: 20_000,
        startingMp: 100,
      }],
      enemies: [{ id: "dummy", hp: 500, attack: 1, defense: 0, speed: 1, critBps: 0 }],
      rules: {
        maxTurns: 1,
        varianceMinBps: 10_000,
        varianceMaxBps: 10_000,
        defaultCritBps: 0,
      },
    });

    expect(battle.events[0]?.action).toBe("ultimate");
    expect(battle.events[0]?.damage).toBe(80);
  });

  it("supports deterministic healing ultimates", () => {
    const battle = simulateWave({
      seed: 3,
      allies: [
        {
          id: "healer",
          hp: 100,
          attack: 30,
          defense: 10,
          speed: 20,
          critBps: 0,
          ultimatePowerBps: 20_000,
          ultimateKind: "heal",
          ultimateTargeting: "lowest_hp",
          startingMp: 100,
        },
        {
          id: "wounded_ally",
          hp: 100,
          attack: 10,
          defense: 10,
          speed: 5,
          critBps: 0,
        },
      ],
      enemies: [
        {
          id: "fast_enemy",
          hp: 500,
          attack: 40,
          defense: 0,
          speed: 30,
          critBps: 0,
          targeting: "lowest_hp",
        },
      ],
      rules: {
        maxTurns: 2,
        varianceMinBps: 10_000,
        varianceMaxBps: 10_000,
        defaultCritBps: 0,
      },
    });

    const healEvent = battle.events.find((event) => event.action === "ultimate");
    expect(healEvent?.actorId).toBe("healer");
    expect(healEvent?.damage).toBe(0);
    expect(healEvent?.healing).toBeGreaterThan(0);
  });

  it("supports deterministic role-aware targeting", () => {
    const battle = simulateWave({
      seed: 99,
      allies: [{
        id: "hunter",
        hp: 100,
        attack: 30,
        defense: 10,
        speed: 20,
        critBps: 0,
        targeting: "lowest_hp",
      }],
      enemies: [
        { id: "healthy", hp: 100, attack: 1, defense: 0, speed: 1, critBps: 0 },
        { id: "wounded", hp: 20, attack: 1, defense: 0, speed: 1, critBps: 0 },
      ],
      rules: {
        maxTurns: 1,
        varianceMinBps: 10_000,
        varianceMaxBps: 10_000,
        defaultCritBps: 0,
      },
    });

    expect(battle.events[0]?.targetId).toBe("wounded");
  });

  it("applies family advantage without ambient randomness", () => {
    const baseInput = {
      seed: 7,
      allies: [{
        id: "a",
        hp: 100,
        attack: 50,
        defense: 10,
        speed: 20,
        critBps: 0,
        familyId: "alpha",
      }],
      enemies: [{
        id: "b",
        hp: 500,
        attack: 1,
        defense: 0,
        speed: 1,
        critBps: 0,
        familyId: "beta",
      }],
      rules: {
        maxTurns: 1,
        varianceMinBps: 10_000,
        varianceMaxBps: 10_000,
        defaultCritBps: 0,
      },
    };

    const neutral = simulateWave(baseInput);
    const advantaged = simulateWave({
      ...baseInput,
      rules: {
        ...baseInput.rules,
        familyAdvantage: { alpha: "beta" },
      },
    });

    expect(advantaged.events[0]!.damage).toBeGreaterThan(neutral.events[0]!.damage);
  });

  it("replays identically for the same seed", () => {
    const input = {
      seed: 77,
      allies: [
        { id: "a", hp: 100, attack: 30, defense: 10, speed: 10 },
      ],
      enemies: [
        { id: "b", hp: 100, attack: 30, defense: 10, speed: 9 },
      ],
    };

    expect(simulateWave(input)).toEqual(simulateWave(input));
  });

  it("contains no ambient random call in game-core source", () => {
    const testDir = fileURLToPath(new URL(".", import.meta.url));
    const srcDir = join(testDir, "..", "src");
    const forbidden = "Math" + ".random(";

    for (const filename of readdirSync(srcDir)) {
      if (!filename.endsWith(".ts")) continue;
      const source = readFileSync(join(srcDir, filename), "utf8");
      expect(source.includes(forbidden), filename).toBe(false);
    }
  });
});
