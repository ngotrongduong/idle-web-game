import generatedConfig from "../generated/config.json";
import {
  validateMvpContentSlice,
} from "./schema";

export { loadGameDataFromCsv, parseCsv, type CsvSources } from "./csv";
export {
  BossSchema,
  ClassFamilySchema,
  ClassRoleSchema,
  ClassSkillSchema,
  DungeonSchema,
  DungeonWaveSchema,
  EnemySchema,
  GameDataSchema,
  HeroClassSchema,
  ItemSchema,
  MaterialSchema,
  RecipeIngredientSchema,
  SkillEffectSchema,
  SkillTargetSchema,
  validateGameData,
  validateMvpContentSlice,
  type GameData,
} from "./schema";

export const foundationGameData = validateMvpContentSlice(generatedConfig);
