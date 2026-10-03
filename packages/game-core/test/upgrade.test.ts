import { describe, expect, it } from "vitest";
import {
  getUpgradeSuccessBps,
  SeededRng,
  simulateUpgradeJourney,
  resolveUpgradeAttempt,
} from "../src/index";

describe("upgrade model", () => {
  it("applies +5% pity per failure and caps at 100%", () => {
    expect(getUpgradeSuccessBps(10, 0)).toBe(3500);
    expect(getUpgradeSuccessBps(10, 3)).toBe(5000);
    expect(getUpgradeSuccessBps(10, 99)).toBe(10_000);
  });

  it("never falls below the +5 safe level", () => {
    const alwaysFailAtSix = new SeededRng(1);
    const result = resolveUpgradeAttempt(
      { level: 5, pityFailures: 0 },
      alwaysFailAtSix,
    );

    if (!result.success) {
      expect(result.afterLevel).toBe(5);
    }
  });

  it("has a stable seeded +10 journey", () => {
    expect(
      simulateUpgradeJourney({ seed: 42, targetLevel: 10 }),
    ).toMatchObject({
      completed: true,
      attempts: 73,
      failures: 37,
      finalLevel: 10,
    });
  });
});
