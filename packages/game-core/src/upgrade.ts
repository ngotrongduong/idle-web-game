import { SeededRng } from "./rng.js";

export const UPGRADE_SUCCESS_BPS = [
  10_000, 9_500, 9_000, 8_000, 7_000, 6_000, 5_000, 4_500, 4_000, 3_500,
] as const;

export const UPGRADE_PITY_STEP_BPS = 500;
export const UPGRADE_SAFE_LEVEL = 5;
export const UPGRADE_MAX_LEVEL = UPGRADE_SUCCESS_BPS.length;

/** Tunable enhancement table; callers pass the validated game-data values. */
export type UpgradeRules = {
  successBps: readonly number[];
  pityStepBps: number;
  safeLevel: number;
};

export const DEFAULT_UPGRADE_RULES: UpgradeRules = {
  successBps: UPGRADE_SUCCESS_BPS,
  pityStepBps: UPGRADE_PITY_STEP_BPS,
  safeLevel: UPGRADE_SAFE_LEVEL,
};

export type UpgradeState = {
  level: number;
  pityFailures: number;
};

export type UpgradeAttemptResult = {
  beforeLevel: number;
  targetLevel: number;
  afterLevel: number;
  success: boolean;
  successBps: number;
  pityFailures: number;
};

function assertLevel(level: number, maxLevel: number): void {
  if (!Number.isInteger(level) || level < 0 || level > maxLevel) {
    throw new Error(`upgrade level must be an integer from 0 to ${maxLevel}`);
  }
}

function assertPityFailures(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("pityFailures must be a non-negative integer");
  }
}

export function getUpgradeSuccessBps(
  targetLevel: number,
  pityFailures = 0,
  rules: UpgradeRules = DEFAULT_UPGRADE_RULES,
): number {
  const maxLevel = rules.successBps.length;
  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > maxLevel) {
    throw new Error(`targetLevel must be an integer from 1 to ${maxLevel}`);
  }
  assertPityFailures(pityFailures);

  const base = rules.successBps[targetLevel - 1]!;
  return Math.min(10_000, base + pityFailures * rules.pityStepBps);
}

export function resolveUpgradeAttempt(
  state: UpgradeState,
  rng: SeededRng,
  rules: UpgradeRules = DEFAULT_UPGRADE_RULES,
): UpgradeAttemptResult {
  const maxLevel = rules.successBps.length;
  assertLevel(state.level, maxLevel);
  assertPityFailures(state.pityFailures);

  if (state.level >= maxLevel) {
    throw new Error("item is already at maximum upgrade level");
  }

  const beforeLevel = state.level;
  const targetLevel = beforeLevel + 1;
  const successBps = getUpgradeSuccessBps(targetLevel, state.pityFailures, rules);
  const success = rng.nextInt(10_000) < successBps;

  if (success) {
    return {
      beforeLevel,
      targetLevel,
      afterLevel: targetLevel,
      success: true,
      successBps,
      pityFailures: 0,
    };
  }

  const afterLevel =
    targetLevel >= rules.safeLevel + 1 ? Math.max(rules.safeLevel, beforeLevel - 1) : beforeLevel;

  return {
    beforeLevel,
    targetLevel,
    afterLevel,
    success: false,
    successBps,
    pityFailures: state.pityFailures + 1,
  };
}

export function simulateUpgradeJourney(input: {
  seed: number;
  targetLevel?: number;
  maxAttempts?: number;
}): {
  completed: boolean;
  attempts: number;
  failures: number;
  finalLevel: number;
  pityFailures: number;
} {
  const targetLevel = input.targetLevel ?? UPGRADE_MAX_LEVEL;
  const maxAttempts = input.maxAttempts ?? 10_000;

  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > UPGRADE_MAX_LEVEL) {
    throw new Error(`targetLevel must be an integer from 1 to ${UPGRADE_MAX_LEVEL}`);
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("maxAttempts must be a positive integer");
  }

  const rng = new SeededRng(input.seed);
  let state: UpgradeState = { level: 0, pityFailures: 0 };
  let attempts = 0;
  let failures = 0;

  while (state.level < targetLevel && attempts < maxAttempts) {
    const result = resolveUpgradeAttempt(state, rng);
    attempts += 1;
    if (!result.success) failures += 1;
    state = {
      level: result.afterLevel,
      pityFailures: result.pityFailures,
    };
  }

  return {
    completed: state.level >= targetLevel,
    attempts,
    failures,
    finalLevel: state.level,
    pityFailures: state.pityFailures,
  };
}
