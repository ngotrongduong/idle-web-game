import generatedConfig from "../generated/config.json";
import {
  validateMvpContentSlice,
} from "./schema";

export { loadGameDataFromCsv, parseCsv, type CsvSources } from "./csv";
export {
  ClassFamilySchema,
  ClassRoleSchema,
  DungeonSchema,
  EnemySchema,
  GameDataSchema,
  HeroClassSchema,
  ItemSchema,
  MaterialSchema,
  RecipeIngredientSchema,
  validateGameData,
  validateMvpContentSlice,
  type GameData,
} from "./schema";

export const foundationGameData = validateMvpContentSlice(generatedConfig);
