import { describe, expect, it } from "vitest";
import { clampInt, GAME_CORE_VERSION } from "../src/index";

describe("game-core foundation", () => {
  it("exports a stable foundation version", () => {
    expect(GAME_CORE_VERSION).toBe("m0-foundation");
  });

  it("keeps integer values inside bounds", () => {
    expect(clampInt(11.8, 0, 10)).toBe(10);
    expect(clampInt(-2, 0, 10)).toBe(0);
    expect(clampInt(5.9, 0, 10)).toBe(5);
  });
});
