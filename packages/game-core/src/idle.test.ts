import { describe, expect, it } from "vitest";
import { calculateIdleAccrual } from "./idle";

describe("calculateIdleAccrual", () => {
  it("applies 75% idle efficiency while preserving partial-cycle time", () => {
    const result = calculateIdleAccrual({
      lastAccruedAtMs: 0,
      nowMs: 600_000,
      cycleDurationMs: 60_000,
      efficiencyBps: 7_500,
      offlineCapMs: 8 * 60 * 60 * 1_000,
    });

    expect(result.wallCycleMs).toBe(80_000);
    expect(result.cycles).toBe(7);
    expect(result.nextAccruedAtMs).toBe(560_000);
  });

  it("discards time older than the offline cap", () => {
    const tenHours = 10 * 60 * 60 * 1_000;
    const result = calculateIdleAccrual({
      lastAccruedAtMs: 0,
      nowMs: tenHours,
      cycleDurationMs: 60_000,
      efficiencyBps: 7_500,
      offlineCapMs: 8 * 60 * 60 * 1_000,
    });

    expect(result.discardedMs).toBe(2 * 60 * 60 * 1_000);
    expect(result.cycles).toBe(360);
    expect(result.nextAccruedAtMs).toBe(tenHours);
  });
});
