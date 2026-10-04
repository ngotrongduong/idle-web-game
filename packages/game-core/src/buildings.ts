export type BuildingId = "hall" | "forge";

export type Construction = {
  building: BuildingId;
  targetLevel: number;
  startedAt: string;
  completesAt: string;
};

export type BuildingState = {
  hallLevel: number;
  forgeLevel: number;
  construction: Construction | null;
};

function assertTime(label: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite timestamp`);
}

/**
 * Applies a construction whose timer has run out. Pure: the caller supplies the clock, so the
 * same stored state and time always give the same levels. Returns the input object unchanged
 * while the construction is still running (or when there is none).
 */
export function settleConstruction<T extends BuildingState>(state: T, nowMs: number): T {
  assertTime("nowMs", nowMs);
  const { construction } = state;
  if (!construction) return state;

  const completesAtMs = Date.parse(construction.completesAt);
  assertTime("construction.completesAt", completesAtMs);
  if (nowMs < completesAtMs) return state;

  return {
    ...state,
    ...(construction.building === "hall"
      ? { hallLevel: construction.targetLevel }
      : { forgeLevel: construction.targetLevel }),
    construction: null,
  };
}

/**
 * Spends speed-up items on a running construction. Never uses more items than the remaining
 * time needs, so a request for "all my items" cannot waste them.
 */
export function speedUpConstruction(input: {
  completesAtMs: number;
  nowMs: number;
  secondsPerItem: number;
  requestedItems: number;
  availableItems: number;
}): { itemsUsed: number; completesAtMs: number } {
  const { completesAtMs, nowMs, secondsPerItem, requestedItems, availableItems } = input;
  assertTime("completesAtMs", completesAtMs);
  assertTime("nowMs", nowMs);
  if (!Number.isInteger(secondsPerItem) || secondsPerItem <= 0) {
    throw new Error("secondsPerItem must be a positive integer");
  }
  for (const [label, value] of [
    ["requestedItems", requestedItems],
    ["availableItems", availableItems],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer`);
    }
  }

  const remainingMs = completesAtMs - nowMs;
  if (remainingMs <= 0) return { itemsUsed: 0, completesAtMs };

  const msPerItem = secondsPerItem * 1_000;
  const itemsNeeded = Math.ceil(remainingMs / msPerItem);
  const itemsUsed = Math.min(requestedItems, availableItems, itemsNeeded);
  return {
    itemsUsed,
    completesAtMs: Math.max(nowMs, completesAtMs - itemsUsed * msPerItem),
  };
}
