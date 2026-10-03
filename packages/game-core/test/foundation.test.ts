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
