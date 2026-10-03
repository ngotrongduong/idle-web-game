export { fnv1a32 } from "./hash";
export { SeededRng } from "./rng";
export {
  DEFAULT_BATTLE_RULES,
  scaleStat,
  simulateWave,
  type BattleEvent,
  type BattleResult,
  type BattleRules,
  type Combatant,
} from "./battle";
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
} from "./upgrade";

export const GAME_CORE_VERSION = "m0.5-simulation-ready";

export function clampInt(value: number, min: number, max: number): number {
  const integer = Math.trunc(value);
  if (integer < min) return min;
  if (integer > max) return max;
  return integer;
}
