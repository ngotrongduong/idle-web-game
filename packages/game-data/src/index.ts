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
} from "./schema";

export const foundationGameData = validateGameData(generatedConfig);

export { TavernConfigSchema, tavernConfig, type TavernConfig } from "./tavern.js";
