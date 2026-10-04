import { describe, expect, it } from "vitest";
import { DEFAULT_BATTLE_RULES, simulateWave } from "@idle/game-core";
import legacyRunV1 from "./fixtures/legacy-run-v1.json";
import { verifyDungeonRunReplay, type ReplayRunSnapshot } from "./replay";

describe("client dungeon replay verification", () => {
  it("replays a server-style snapshot to the same hash", () => {
    const allies = [
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
    ];
    const enemies = [
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
    ];
    const seed = 123456;
    const serverResult = simulateWave({
      allies,
      enemies,
      seed,
      rules: DEFAULT_BATTLE_RULES,
    });

    const verification = verifyDungeonRunReplay({
      battleRules: DEFAULT_BATTLE_RULES,
      waves: [
        {
          wave: 1,
          seed,
          hash: serverResult.hash,
          allies,
          enemies,
        },
      ],
    });

    expect(verification.ok).toBe(true);
    expect(verification.waves[0]?.actualHash).toBe(serverResult.hash);
  });

  it("detects a mismatched persisted hash", () => {
    const verification = verifyDungeonRunReplay({
      battleRules: DEFAULT_BATTLE_RULES,
      waves: [
        {
          wave: 1,
          seed: 1,
          hash: "00000000",
          allies: [{ id: "hero", hp: 100, attack: 30, defense: 10, speed: 10 }],
          enemies: [{ id: "enemy", hp: 100, attack: 20, defense: 10, speed: 9 }],
        },
      ],
    });

    expect(verification.ok).toBe(false);
    expect(verification.waves[0]?.matches).toBe(false);
  });

  it("still replays a run persisted with battle formula v1", () => {
    // Captured from the server before combat v2; persisted runs must keep verifying in the browser.
    const verification = verifyDungeonRunReplay(legacyRunV1 as unknown as ReplayRunSnapshot);

    expect(verification.ok).toBe(true);
    expect(verification.waves.map((wave) => wave.actualHash)).toEqual([
      "351b4107",
      "05742f3a",
      "33ae37cf",
      "a435234e",
      "d0930499",
      "6ff0ac39",
    ]);
  });
});
