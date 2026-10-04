export type HeroExperienceState = {
  level: number;
  exp: number;
  tier: number;
};

export type HeroExperienceResult = HeroExperienceState & {
  levelsGained: number;
  expConsumed: number;
  expDiscarded: number;
  atLevelCap: boolean;
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

export function levelCapForTier(tier: number): number {
  assertPositiveInteger(tier, "tier");
  return 10 * tier;
}

export function xpToNext(level: number, tier: number): number {
  assertPositiveInteger(level, "level");
  assertPositiveInteger(tier, "tier");
  return Math.round((20 + 18 * level ** 1.7) * 1.6 ** (tier - 1));
}

export function applyHeroExperience(
  state: HeroExperienceState,
  gainedExp: number,
): HeroExperienceResult {
  assertPositiveInteger(state.level, "level");
  assertNonNegativeInteger(state.exp, "exp");
  assertPositiveInteger(state.tier, "tier");
  assertNonNegativeInteger(gainedExp, "gainedExp");

  const cap = levelCapForTier(state.tier);
  if (state.level > cap) {
    throw new Error(`level ${state.level} exceeds tier ${state.tier} cap ${cap}`);
  }

  if (state.level === cap) {
    return {
      level: cap,
      exp: 0,
      tier: state.tier,
      levelsGained: 0,
      expConsumed: 0,
      expDiscarded: state.exp + gainedExp,
      atLevelCap: true,
    };
  }

  let level = state.level;
  let exp = state.exp + gainedExp;
  let expConsumed = 0;
  let levelsGained = 0;

  while (level < cap) {
    const required = xpToNext(level, state.tier);
    if (exp < required) break;

    exp -= required;
    expConsumed += required;
    level += 1;
    levelsGained += 1;

    if (level === cap) {
      const expDiscarded = exp;
      return {
        level,
        exp: 0,
        tier: state.tier,
        levelsGained,
        expConsumed,
        expDiscarded,
        atLevelCap: true,
      };
    }
  }

  return {
    level,
    exp,
    tier: state.tier,
    levelsGained,
    expConsumed,
    expDiscarded: 0,
    atLevelCap: false,
  };
}
