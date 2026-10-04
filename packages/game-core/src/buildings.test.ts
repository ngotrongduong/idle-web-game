import { describe, expect, it } from "vitest";
import { settleConstruction, speedUpConstruction, type BuildingState } from "./buildings";

const START = Date.parse("2026-10-05T00:00:00.000Z");

function building(overrides: Partial<BuildingState> = {}): BuildingState {
  return {
    hallLevel: 1,
    forgeLevel: 1,
    construction: {
      building: "hall",
      targetLevel: 2,
      startedAt: new Date(START).toISOString(),
      completesAt: new Date(START + 60_000).toISOString(),
    },
    ...overrides,
  };
}

describe("settleConstruction", () => {
  it("keeps the old level until the timer runs out", () => {
    const state = building();
    expect(settleConstruction(state, START + 59_999)).toBe(state);
  });

  it("applies the target level exactly when the timer ends and frees the builder", () => {
    expect(settleConstruction(building(), START + 60_000)).toEqual({
      hallLevel: 2,
      forgeLevel: 1,
      construction: null,
    });
  });

  it("levels the building named by the construction", () => {
    const state = building({
      construction: { ...building().construction!, building: "forge", targetLevel: 2 },
    });
    expect(settleConstruction(state, START + 3_600_000)).toMatchObject({
      hallLevel: 1,
      forgeLevel: 2,
      construction: null,
    });
  });

  it("is a no-op without a construction and when applied twice", () => {
    const idle = building({ construction: null });
    expect(settleConstruction(idle, START)).toBe(idle);
    const settled = settleConstruction(building(), START + 60_000);
    expect(settleConstruction(settled, START + 120_000)).toBe(settled);
  });

  it("keeps unrelated fields of the state", () => {
    const state = { ...building(), gold: 42 };
    expect(settleConstruction(state, START + 60_000).gold).toBe(42);
  });
});

describe("speedUpConstruction", () => {
  const base = { completesAtMs: START + 700_000, nowMs: START, secondsPerItem: 300 };

  it("removes five minutes per item", () => {
    expect(speedUpConstruction({ ...base, requestedItems: 1, availableItems: 5 })).toEqual({
      itemsUsed: 1,
      completesAtMs: START + 400_000,
    });
  });

  it("never spends more items than the remaining time needs", () => {
    expect(speedUpConstruction({ ...base, requestedItems: 99, availableItems: 99 })).toEqual({
      itemsUsed: 3,
      completesAtMs: START,
    });
  });

  it("is limited by the items the player owns", () => {
    expect(speedUpConstruction({ ...base, requestedItems: 3, availableItems: 2 })).toEqual({
      itemsUsed: 2,
      completesAtMs: START + 100_000,
    });
  });

  it("spends nothing on a construction that already finished", () => {
    expect(
      speedUpConstruction({
        ...base,
        nowMs: START + 700_000,
        requestedItems: 1,
        availableItems: 1,
      }),
    ).toEqual({ itemsUsed: 0, completesAtMs: START + 700_000 });
  });

  it("rejects fractional or negative item counts", () => {
    expect(() => speedUpConstruction({ ...base, requestedItems: 1.5, availableItems: 2 })).toThrow(
      "requestedItems",
    );
    expect(() => speedUpConstruction({ ...base, requestedItems: 1, availableItems: -1 })).toThrow(
      "availableItems",
    );
  });
});
