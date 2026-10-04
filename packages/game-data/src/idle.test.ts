import { describe, expect, it } from "vitest";
import { idleConfig } from "./idle";

describe("idle config", () => {
  it("keeps M1 idle tuning data-driven", () => {
    expect(idleConfig).toEqual({
      cycleDurationSeconds: 48,
      offlineCapHours: 8,
      offlineEfficiencyBps: 7_500,
    });
  });
});
