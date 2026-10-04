import generatedConfig from "../generated/config.json" with { type: "json" };
import rawLootConfig from "../data/loot.json" with { type: "json" };
import { validateLootConfig } from "./loot.js";
import { promotionConfig } from "./promotion.js";
import { validateGameData } from "./schema.js";
import { battleConfig } from "./battle.js";

export { loadGameDataFromCsv, parseCsv, type CsvSources } from "./csv.js";
export {
  ClassFamilySchema,
  DungeonSchema,
  EnemySchema,
  GameDataSchema,
  HeroClassSchema,
  ItemSchema,
  MaterialSchema,
  RecipeIngredientSchema,
  validateGameData,
  type GameData,
} from "./schema.js";

export const foundationGameData = validateGameData(generatedConfig);

export {
  LootConfigSchema,
  LootRankSchema,
  LootRuleSchema,
  validateLootConfig,
  type LootConfig,
  type LootRule,
} from "./loot.js";

export const lootConfig = validateLootConfig(rawLootConfig, foundationGameData, promotionConfig);

/** Battle rules snapshotted into new dungeon runs (formula v2) and used by the sims. */
export const currentBattleRules = {
  formulaVersion: battleConfig.formulaVersion,
  maxTurns: battleConfig.maxTurns,
  defenseK: battleConfig.defenseKBase,
  defenseKBase: battleConfig.defenseKBase,
  defenseKPerLevel: battleConfig.defenseKPerLevel,
  varianceMinBps: battleConfig.varianceMinBps,
  varianceMaxBps: battleConfig.varianceMaxBps,
  defaultCritBps: battleConfig.defaultCritBps,
  critMultiplierBps: battleConfig.critMultiplierBps,
  critCapBps: battleConfig.critCapBps,
  mpMax: battleConfig.mpMax,
  mpPerAction: battleConfig.mpPerAction,
  mpOnHit: battleConfig.mpOnHit,
  familyAdvantage: Object.fromEntries(
    foundationGameData.classFamilies.map((family) => [family.id, family.advantageFamilyId]),
  ) as Record<string, string>,
  advantageMultiplierBps: battleConfig.advantageMultiplierBps,
  disadvantageMultiplierBps: battleConfig.disadvantageMultiplierBps,
};

/** How persisted heroes enter a wave (starting MP, crit), shared by the server and the sims. */
export const combatantSetup = {
  mpMax: battleConfig.mpMax,
  startingMpBps: battleConfig.startingMpBps,
  defaultCritBps: battleConfig.defaultCritBps,
  rangedCritBonusBps: battleConfig.rangedCritBonusBps,
};

{
  const dungeonIds = new Set(foundationGameData.dungeons.map((dungeon) => dungeon.id));
  const configured = Object.keys(battleConfig.enemyStatMultiplierBps);
  const missing = [...dungeonIds].filter((id) => !configured.includes(id));
  const unknown = configured.filter((id) => !dungeonIds.has(id));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `battle.json enemyStatMultiplierBps must list every dungeon (missing: ${missing.join(",") || "-"}, unknown: ${unknown.join(",") || "-"})`,
    );
  }
}

export {
  CraftQualityTierSchema,
  EquipmentConfigSchema,
  enhancementBonusBps,
  enhancementGoldCost,
  equipmentConfig,
  equipmentStatValue,
  itemSellGold,
  type CraftQualityTier,
  type EquipmentConfig,
} from "./equipment.js";
export { IdleConfigSchema, idleConfig, type IdleConfig } from "./idle.js";
export { BattleConfigSchema, battleConfig, type BattleConfig } from "./battle.js";
export {
  PromotionConfigSchema,
  promotionConfig,
  promotionRuleForTier,
  type PromotionConfig,
  type PromotionRule,
} from "./promotion.js";
export { TavernConfigSchema, tavernConfig, type TavernConfig } from "./tavern.js";
