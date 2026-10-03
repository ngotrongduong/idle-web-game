import { describe, expect, it } from "vitest";
import { GAME_CORE_VERSION } from "@idle/game-core";

describe("sim foundation", () => {
  it("depends on the shared game-core package", () => {
    expect(GAME_CORE_VERSION).toBe("m0-foundation");
  });
});
