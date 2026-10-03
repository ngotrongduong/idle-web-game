import { describe, expect, it } from "vitest";
import {
  HALL_MAX_LEVEL,
  hallUpgradeGoldCost,
} from "../src/index";

describe("foundation economy", () => {
  it("uses the documented hall upgrade costs", () => {
    expect(hallUpgradeGoldCost(1)).toBe(300);
    expect(hallUpgradeGoldCost(5)).toBe(13_710);
    expect(hallUpgradeGoldCost(9)).toBe(626_480);
  });

  it("rejects upgrades beyond the max hall level", () => {
    expect(() => hallUpgradeGoldCost(HALL_MAX_LEVEL)).toThrow(
      "maximum level",
    );
  });
});
