import { describe, expect, it } from "vitest";
import { GAME_CORE_VERSION, simulateWave } from "@idle/game-core";

describe("sim foundation", () => {
  it("depends on the deterministic shared game-core package", () => {
    expect(GAME_CORE_VERSION).toBe("m0.4-deterministic-battle");
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
});
