export const HALL_MAX_LEVEL = 10;

export const HALL_UPGRADE_GOLD_COST = [
  300,
  780,
  2_030,
  5_270,
  13_710,
  35_640,
  92_670,
  240_950,
  626_480,
] as const;

export function hallUpgradeGoldCost(currentLevel: number): number {
  if (!Number.isInteger(currentLevel) || currentLevel < 1) {
    throw new Error("currentLevel must be a positive integer");
  }
  if (currentLevel >= HALL_MAX_LEVEL) {
    throw new Error("hall is already at maximum level");
  }

  return HALL_UPGRADE_GOLD_COST[currentLevel - 1]!;
}
