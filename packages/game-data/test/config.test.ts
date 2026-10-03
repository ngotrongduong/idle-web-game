import { describe, expect, it } from "vitest";
import { foundationConfig, GameConfigSchema } from "../src/index";

describe("game-data foundation", () => {
  it("validates the first config object", () => {
    expect(foundationConfig.offlineCapHours).toBe(8);
  });

  it("rejects invalid negative currency", () => {
    expect(
      GameConfigSchema.safeParse({
        version: "bad",
        starterGold: -1,
        offlineCapHours: 8,
      }).success,
    ).toBe(false);
  });
});
