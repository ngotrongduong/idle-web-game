import { getUpgradeSuccessBps, teamLimitForHall } from "@idle/game-core";
import {
  buildingUpgrade,
  buildingsConfig,
  equipmentConfig,
  enhancementDustCost,
  enhancementGoldCost,
  forgeMaxEnhanceLevel,
  foundationGameData,
  idleConfig,
  itemSellGold,
  lootConfig,
  promotionConfig,
} from "@idle/game-data";
import { buildDungeonWave } from "./scenarios";

const TARGET_ONLINE_GOLD_PER_HOUR: Record<string, number> = {
  bamboo_grove: 5_400,
  misty_riverbank: 12_400,
  sunken_shrine: 28_600,
  ember_ridge: 65_700,
};

const GOLD_DEVIATION_WARNING_RATIO = 0.2;

/** Gold a new guest starts with (`createGuest` in the server stores). */
const STARTING_GOLD = 1_000;
/** docs/03 §4 pacing targets, in minutes after the first dungeon run starts. */
const TEAM_TWO_TARGET_MINUTES = 6;
const PACING_WARNING_RATIO = 0.2;

export type EconomyDungeonSummary = {
  dungeonId: string;
  name: string;
  cycleGold: number;
  cycleExp: number;
  onlineCyclesPerHour: number;
  passiveCyclesPerHour: number;
  onlineGoldPerHour: number;
  passiveGoldPerHour: number;
  passiveCapCycles: number;
  passiveCapGold: number;
  targetOnlineGoldPerHour: number | null;
  targetDeviationRatio: number | null;
  expectedLootPerCycle: Record<string, number>;
  expectedLootAtPassiveCap: Record<string, number>;
};

export type EconomyRecipeSummary = {
  itemId: string;
  itemName: string;
  sourceDungeonId: string | null;
  expectedOnlineMinutes: number | null;
  expectedPassiveMinutes: number | null;
  baseSellGold: number;
  averageQualitySellGold: number;
};

export type EconomySummary = {
  dungeons: EconomyDungeonSummary[];
  recipes: EconomyRecipeSummary[];
  enhancement: {
    targetLevel: number;
    expectedAttempts: number;
    expectedGold: number;
    /** Forge Dust for the same journey; common items dismantle into 1 dust each. */
    expectedDust: number;
    d1OnlineGoldMinutes: number;
    /** Gold, materials aside, and build time to raise the Forge until it allows targetLevel. */
    forgeLevelRequired: number;
  };
  buildings: {
    hall: BuildingPathSummary;
    forge: BuildingPathSummary;
    /** Earliest second parallel team when the starting dungeon's passive gold goes to the Hall. */
    teamTwo: {
      hallLevel: number;
      minutes: number;
      targetMinutes: number;
    };
  };
  promotion: {
    rules: typeof promotionConfig.rules;
  };
  warnings: string[];
};

export type BuildingPathSummary = {
  /** Totals for level 1 → max. */
  totalGold: number;
  totalBuildHours: number;
  /** Longest single build, which is the wait a speed-up item is weighed against. */
  longestBuildMinutes: number;
};

function buildingPath(building: "hall" | "forge"): BuildingPathSummary {
  let totalGold = 0;
  let totalSeconds = 0;
  let longestSeconds = 0;
  for (let level = 1; level < buildingsConfig.maxLevel; level += 1) {
    const upgrade = buildingUpgrade(building, level)!;
    totalGold += upgrade.goldCost;
    totalSeconds += upgrade.buildSeconds;
    longestSeconds = Math.max(longestSeconds, upgrade.buildSeconds);
  }
  return {
    totalGold,
    totalBuildHours: round(totalSeconds / 3_600),
    longestBuildMinutes: round(longestSeconds / 60),
  };
}

/**
 * Seconds until the Hall reaches `targetLevel` when every upgrade starts as soon as the builder
 * is free and the gold is there. Gold is the starting purse plus the passive income of one team,
 * which only arrives in whole idle cycles.
 */
function secondsToHallLevel(
  targetLevel: number,
  goldPerCycle: number,
  cycleSeconds: number,
): number {
  let gold = STARTING_GOLD;
  let seconds = 0;
  let paidCycles = 0;
  for (let level = 1; level < targetLevel; level += 1) {
    const upgrade = buildingUpgrade("hall", level)!;
    const finishedCycles = Math.floor(seconds / cycleSeconds) - paidCycles;
    gold += finishedCycles * goldPerCycle;
    paidCycles += finishedCycles;

    if (gold < upgrade.goldCost) {
      if (goldPerCycle <= 0) return Number.POSITIVE_INFINITY;
      const cycles = Math.ceil((upgrade.goldCost - gold) / goldPerCycle);
      gold += cycles * goldPerCycle;
      paidCycles += cycles;
      seconds = paidCycles * cycleSeconds;
    }
    gold -= upgrade.goldCost;
    seconds += upgrade.buildSeconds;
  }
  return seconds;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function expectedRuleQuantity(rule: { chanceBps: number; minQty: number; maxQty: number }): number {
  return (rule.chanceBps / 10_000) * ((rule.minQty + rule.maxQty) / 2);
}

function enemyRankCounts(dungeonId: string): Record<string, number> {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon ${dungeonId}`);

  const counts: Record<string, number> = {};
  for (let wave = 1; wave <= dungeon.waveCount; wave += 1) {
    const generated = buildDungeonWave(dungeonId, wave);
    for (const enemy of generated.enemies) {
      const spec = foundationGameData.enemies.find((entry) => entry.id === enemy.id);
      if (!spec) throw new Error(`Unknown enemy ${enemy.id}`);
      counts[spec.rank] = (counts[spec.rank] ?? 0) + 1;
    }
  }
  return counts;
}

function expectedLootForDungeon(dungeonId: string): Record<string, number> {
  const rankCounts = enemyRankCounts(dungeonId);
  const output: Record<string, number> = {};

  for (const rule of lootConfig.rules.filter((entry) => entry.dungeonId === dungeonId)) {
    const kills = rankCounts[rule.rank] ?? 0;
    const expected = kills * expectedRuleQuantity(rule);
    output[rule.materialId] = (output[rule.materialId] ?? 0) + expected;
  }

  return Object.fromEntries(
    Object.entries(output)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, qty]) => [id, round(qty, 4)]),
  );
}

// The same enhancement table the server rolls with (game-data equipment config).
const ENHANCEMENT_RULES = {
  successBps: equipmentConfig.enhanceSuccessBps,
  pityStepBps: equipmentConfig.enhancePityStepBps,
  safeLevel: equipmentConfig.maxEnhanceLevel,
};

function expectedAttemptsForLevel(level: number): number {
  let survival = 1;
  let expected = 0;

  for (let pityFailures = 0; pityFailures < 100 && survival > 1e-12; pityFailures += 1) {
    expected += survival;
    const successBps = getUpgradeSuccessBps(level + 1, pityFailures, ENHANCEMENT_RULES);
    survival *= 1 - successBps / 10_000;

    if (successBps >= 10_000) break;
    if (ENHANCEMENT_RULES.pityStepBps <= 0 && pityFailures > 20) break;
  }

  return expected;
}

function averageQualityMultiplier(): number {
  return equipmentConfig.qualityTiers.reduce(
    (sum, tier) => sum + (tier.weightBps / 10_000) * (tier.multiplierBps / 10_000),
    0,
  );
}

export function runEconomySimulation(): EconomySummary {
  const onlineCyclesPerHour = 3_600 / idleConfig.cycleDurationSeconds;
  const passiveCyclesPerHour = (onlineCyclesPerHour * idleConfig.offlineEfficiencyBps) / 10_000;
  const passiveCapCycles = Math.floor(
    (idleConfig.offlineCapHours * 3_600 * idleConfig.offlineEfficiencyBps) /
      10_000 /
      idleConfig.cycleDurationSeconds,
  );

  const dungeons: EconomyDungeonSummary[] = foundationGameData.dungeons.map((dungeon) => {
    let cycleGold = 0;
    let cycleExp = 0;
    for (let wave = 1; wave <= dungeon.waveCount; wave += 1) {
      const generated = buildDungeonWave(dungeon.id, wave);
      cycleGold += generated.rewardGold;
      cycleExp += generated.rewardExp;
    }

    const expectedLootPerCycle = expectedLootForDungeon(dungeon.id);
    const target = TARGET_ONLINE_GOLD_PER_HOUR[dungeon.id] ?? null;
    const onlineGoldPerHour = cycleGold * onlineCyclesPerHour;

    return {
      dungeonId: dungeon.id,
      name: dungeon.nameEn,
      cycleGold,
      cycleExp,
      onlineCyclesPerHour: round(onlineCyclesPerHour),
      passiveCyclesPerHour: round(passiveCyclesPerHour),
      onlineGoldPerHour: round(onlineGoldPerHour),
      passiveGoldPerHour: round(cycleGold * passiveCyclesPerHour),
      passiveCapCycles,
      passiveCapGold: cycleGold * passiveCapCycles,
      targetOnlineGoldPerHour: target,
      targetDeviationRatio: target === null ? null : round(onlineGoldPerHour / target - 1, 4),
      expectedLootPerCycle,
      expectedLootAtPassiveCap: Object.fromEntries(
        Object.entries(expectedLootPerCycle).map(([id, qty]) => [
          id,
          round(qty * passiveCapCycles, 2),
        ]),
      ),
    };
  });

  const avgQuality = averageQualityMultiplier();
  const recipes: EconomyRecipeSummary[] = foundationGameData.items
    .filter((item) => item.recipe.length > 0)
    .map((item) => {
      const source = dungeons.find((dungeon) =>
        item.recipe.every(
          (ingredient) => (dungeon.expectedLootPerCycle[ingredient.materialId] ?? 0) > 0,
        ),
      );

      let expectedCycles: number | null = null;
      if (source) {
        expectedCycles = Math.max(
          ...item.recipe.map(
            (ingredient) =>
              ingredient.qty / (source.expectedLootPerCycle[ingredient.materialId] ?? 0),
          ),
        );
      }

      const sellGold = itemSellGold(item);
      return {
        itemId: item.id,
        itemName: item.nameEn,
        sourceDungeonId: source?.dungeonId ?? null,
        expectedOnlineMinutes:
          expectedCycles === null
            ? null
            : round((expectedCycles * idleConfig.cycleDurationSeconds) / 60),
        expectedPassiveMinutes:
          expectedCycles === null
            ? null
            : round(
                (expectedCycles * idleConfig.cycleDurationSeconds * 10_000) /
                  idleConfig.offlineEfficiencyBps /
                  60,
              ),
        baseSellGold: sellGold,
        averageQualitySellGold: round(sellGold * avgQuality),
      };
    });

  let expectedEnhanceAttempts = 0;
  let expectedEnhanceGold = 0;
  let expectedEnhanceDust = 0;
  for (let level = 0; level < equipmentConfig.maxEnhanceLevel; level += 1) {
    const attempts = expectedAttemptsForLevel(level);
    expectedEnhanceAttempts += attempts;
    expectedEnhanceGold += attempts * enhancementGoldCost(level);
    expectedEnhanceDust += attempts * enhancementDustCost(level);
  }
  let forgeLevelRequired = 1;
  while (forgeMaxEnhanceLevel(forgeLevelRequired) < equipmentConfig.maxEnhanceLevel) {
    forgeLevelRequired += 1;
  }

  let teamTwoHallLevel = 1;
  while (teamLimitForHall(teamTwoHallLevel) < 2) teamTwoHallLevel += 1;
  const passiveCycleSeconds =
    (idleConfig.cycleDurationSeconds * 10_000) / idleConfig.offlineEfficiencyBps;
  const teamTwoMinutes =
    secondsToHallLevel(teamTwoHallLevel, dungeons[0]?.cycleGold ?? 0, passiveCycleSeconds) / 60;

  const d1Gold = dungeons[0]?.onlineGoldPerHour ?? 0;
  const warnings: string[] = [];
  if (teamTwoMinutes > TEAM_TWO_TARGET_MINUTES * (1 + PACING_WARNING_RATIO)) {
    warnings.push(
      `team_two_slower_than_target: earliest=${round(teamTwoMinutes)}m target=${TEAM_TWO_TARGET_MINUTES}m`,
    );
  }
  for (const dungeon of dungeons) {
    if (
      dungeon.targetDeviationRatio !== null &&
      Math.abs(dungeon.targetDeviationRatio) > GOLD_DEVIATION_WARNING_RATIO
    ) {
      warnings.push(
        `gold_rate_outside_target:${dungeon.dungeonId} actual=${dungeon.onlineGoldPerHour} target=${dungeon.targetOnlineGoldPerHour} deviation=${round(dungeon.targetDeviationRatio * 100, 1)}%`,
      );
    }
  }

  const firstRecipe = recipes[0];
  if (
    firstRecipe?.expectedOnlineMinutes !== null &&
    firstRecipe?.expectedOnlineMinutes !== undefined
  ) {
    if (firstRecipe.expectedOnlineMinutes > 3 * 1.2) {
      warnings.push(
        `first_craft_slower_than_target:${firstRecipe.itemId} expected=${firstRecipe.expectedOnlineMinutes}m target=3m`,
      );
    }
  }

  if (equipmentConfig.craftGoldCost === 0) {
    warnings.push("craft_gold_sink_disabled: craftGoldCost=0");
  }

  return {
    dungeons,
    recipes,
    enhancement: {
      targetLevel: equipmentConfig.maxEnhanceLevel,
      expectedAttempts: round(expectedEnhanceAttempts, 3),
      expectedGold: round(expectedEnhanceGold, 2),
      expectedDust: round(expectedEnhanceDust, 2),
      d1OnlineGoldMinutes: d1Gold > 0 ? round((expectedEnhanceGold / d1Gold) * 60, 2) : 0,
      forgeLevelRequired,
    },
    buildings: {
      hall: buildingPath("hall"),
      forge: buildingPath("forge"),
      teamTwo: {
        hallLevel: teamTwoHallLevel,
        minutes: round(teamTwoMinutes),
        targetMinutes: TEAM_TWO_TARGET_MINUTES,
      },
    },
    promotion: {
      rules: promotionConfig.rules,
    },
    warnings,
  };
}
