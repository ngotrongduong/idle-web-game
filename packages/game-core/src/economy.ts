export const HALL_MAX_LEVEL = 10;

export const HALL_UPGRADE_GOLD_COST = [
  300, 780, 2_030, 5_270, 13_710, 35_640, 92_670, 240_950, 626_480,
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

/** GDD §5.1: parallel teams grow 1 → 4 with the Hall (Lv1: 1, Lv3: 2, Lv6: 3, Lv9: 4). */
export const HALL_PARALLEL_TEAM_UNLOCK_LEVELS = [1, 3, 6, 9] as const;

export function teamLimitForHall(hallLevel: number): number {
  if (!Number.isInteger(hallLevel) || hallLevel < 1 || hallLevel > HALL_MAX_LEVEL) {
    throw new Error(`hallLevel must be an integer between 1 and ${HALL_MAX_LEVEL}`);
  }
  return HALL_PARALLEL_TEAM_UNLOCK_LEVELS.filter((level) => hallLevel >= level).length;
}

export function heroCapacityForHall(hallLevel: number): number {
  if (!Number.isInteger(hallLevel) || hallLevel < 1 || hallLevel > HALL_MAX_LEVEL) {
    throw new Error(`hallLevel must be an integer between 1 and ${HALL_MAX_LEVEL}`);
  }

  return 3 + hallLevel;
}
