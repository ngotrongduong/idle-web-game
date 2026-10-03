import generatedConfig from "../generated/config.json";
import { validateGameData } from "./schema";

export { loadGameDataFromCsv, parseCsv, type CsvSources } from "./csv";
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
