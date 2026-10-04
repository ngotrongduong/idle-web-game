import { describe, expect, it } from "vitest";
import {
  getUpgradeSuccessBps,
  resolveUpgradeAttempt,
  rollCraftQualityBps,
  SeededRng,
} from "../src/index";

describe("craft quality roll", () => {
  const tiers = [
    { weightBps: 5_000, multiplierBps: 10_000 },
    { weightBps: 5_000, multiplierBps: 12_000 },
  ];

  it("is reproducible from its seed", () => {
    const first = Array.from({ length: 20 }, (_, seed) =>
      rollCraftQualityBps(new SeededRng(seed), tiers, 10_000),
    );
    const second = Array.from({ length: 20 }, (_, seed) =>
      rollCraftQualityBps(new SeededRng(seed), tiers, 10_000),
    );
    expect(first).toEqual(second);
    expect(new Set(first)).toEqual(new Set([10_000, 12_000]));
  });

  it("falls back when weights do not cover the whole range", () => {
    expect(rollCraftQualityBps(new SeededRng(1), [], 10_000)).toBe(10_000);
  });
});

describe("injectable enhancement rules", () => {
  it("uses the provided success table, pity step and safe level", () => {
    const rules = { successBps: [10_000, 0], pityStepBps: 2_500, safeLevel: 2 };
    const rng = new SeededRng(7);

    expect(resolveUpgradeAttempt({ level: 0, pityFailures: 0 }, rng, rules)).toMatchObject({
      success: true,
      afterLevel: 1,
    });
    expect(resolveUpgradeAttempt({ level: 1, pityFailures: 0 }, rng, rules)).toMatchObject({
      success: false,
      successBps: 0,
      afterLevel: 1,
      pityFailures: 1,
    });
    expect(getUpgradeSuccessBps(2, 3, rules)).toBe(7_500);
    expect(() => resolveUpgradeAttempt({ level: 2, pityFailures: 0 }, rng, rules)).toThrow(
      /maximum/,
    );
  });
});
