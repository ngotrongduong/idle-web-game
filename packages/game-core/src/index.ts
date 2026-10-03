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

export const GAME_CORE_VERSION = "m0.4-deterministic-battle";

export function clampInt(value: number, min: number, max: number): number {
  const integer = Math.trunc(value);
  if (integer < min) return min;
  if (integer > max) return max;
  return integer;
}
