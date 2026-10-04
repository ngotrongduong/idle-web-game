import generatedConfig from "../generated/config.json" with { type: "json" };
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

export { IdleConfigSchema, idleConfig, type IdleConfig } from "./idle.js";
export {
  PromotionConfigSchema,
  promotionConfig,
  promotionRuleForTier,
  type PromotionConfig,
  type PromotionRule,
} from "./promotion.js";
export { TavernConfigSchema, tavernConfig, type TavernConfig } from "./tavern.js";
