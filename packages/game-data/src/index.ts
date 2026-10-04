import generatedConfig from "../generated/config.json" with { type: "json" };
import rawLootConfig from "../data/loot.json" with { type: "json" };
import { validateLootConfig } from "./loot.js";
import { promotionConfig } from "./promotion.js";
import { validateGameData } from "./schema.js";

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
export {
  PromotionConfigSchema,
  promotionConfig,
  promotionRuleForTier,
  type PromotionConfig,
  type PromotionRule,
} from "./promotion.js";
export { TavernConfigSchema, tavernConfig, type TavernConfig } from "./tavern.js";
