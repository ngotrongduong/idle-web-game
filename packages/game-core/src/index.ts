export const GAME_CORE_VERSION = "m0-foundation";

export type FixedPoint = number;

export function clampInt(value: number, min: number, max: number): number {
  const integer = Math.trunc(value);
  if (integer < min) return min;
  if (integer > max) return max;
  return integer;
}
