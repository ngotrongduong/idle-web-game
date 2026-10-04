export { fnv1a32 } from "./hash.js";
export { SeededRng } from "./rng.js";
export {
  DEFAULT_BATTLE_RULES,
  scaleStat,
  simulateWave,
  type BattleAction,
  type BattleEvent,
  type BattleResult,
  type BattleRules,
  type Combatant,
  type TargetingMode,
} from "./battle.js";
export {
  HALL_MAX_LEVEL,
  HALL_UPGRADE_GOLD_COST,
  hallUpgradeGoldCost,
  heroCapacityForHall,
} from "./economy.js";
export {
  rollTavernRarity,
  type HeroRarity,
  type TavernPityState,
  type TavernRarityRoll,
  type TavernRarityRules,
} from "./tavern.js";
export {
  getUpgradeSuccessBps,
  resolveUpgradeAttempt,
  simulateUpgradeJourney,
  UPGRADE_MAX_LEVEL,
  UPGRADE_PITY_STEP_BPS,
  UPGRADE_SAFE_LEVEL,
  UPGRADE_SUCCESS_BPS,
  type UpgradeAttemptResult,
  type UpgradeState,
} from "./upgrade.js";

export const GAME_CORE_VERSION = "m0.6a-command-ready";

export function clampInt(value: number, min: number, max: number): number {
  const integer = Math.trunc(value);
  if (integer < min) return min;
  if (integer > max) return max;
  return integer;
}
