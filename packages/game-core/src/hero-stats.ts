export type HeroStatRarity = "common" | "elite" | "rare" | "legendary";

export const HERO_RARITY_MULTIPLIER_BPS: Record<HeroStatRarity, number> = {
  common: 10_000,
  elite: 10_800,
  rare: 11_800,
  legendary: 13_000,
};

export type HeroStatPotential = {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
};

export type HeroComputedStats = HeroStatPotential;

export type HeroStatInput = {
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  /** Class tier; levels restart at 1 on promotion, so the multiplier continues across tiers. */
  tier?: number;
  level: number;
  rarity: HeroStatRarity;
  potential?: Partial<HeroStatPotential>;
};

const BPS = 10_000;
const BPS_SQUARED = BPS * BPS;

function assertStat(value: number, label: string, allowZero = false): void {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be an integer ${allowZero ? ">= 0" : ">= 1"}`);
  }
}

export function levelMultiplierBps(level: number): number {
  if (!Number.isInteger(level) || level <= 0) {
    throw new Error("level must be a positive integer");
  }

  const n = level - 1;
  return BPS + 1_200 * n + 40 * n * n;
}

/**
 * Progress through the whole class tree in hundredths of a "T1 level": T1 Lv1–10 covers 0–900,
 * T2 Lv1–20 covers 900–1900 and T3 Lv1–30 covers 1900–2900. A promoted hero therefore keeps the
 * level multiplier it had at the previous cap instead of dropping back to ×1.00.
 */
export function progressionHundredths(tier: number, level: number): number {
  if (!Number.isInteger(tier) || tier <= 0) throw new Error("tier must be a positive integer");
  const cap = 10 * tier;
  if (!Number.isInteger(level) || level <= 0 || level > cap) {
    throw new Error(`level must be an integer from 1 to ${cap} for tier ${tier}`);
  }
  if (tier === 1) return 100 * (level - 1);
  return 900 + 1_000 * (tier - 2) + Math.floor((1_000 * (level - 1)) / (cap - 1));
}

/** docs/03 §2 levelMult on the continuous scale; equals levelMultiplierBps(L) for T1. */
export function tierLevelMultiplierBps(tier: number, level: number): number {
  const n100 = progressionHundredths(tier, level);
  return BPS + 12 * n100 + Math.floor((40 * n100 * n100) / BPS);
}

/** Combat level used by formula v2 (K = 60 + 8·level): 1–10 in T1, 10–20 in T2, 20–30 in T3. */
export function combatLevel(tier: number, level: number): number {
  return Math.floor(progressionHundredths(tier, level) / 100) + 1;
}

function scale(
  base: number,
  multiplierBps: number,
  rarity: HeroStatRarity,
  potential: number,
): number {
  const scaled = Math.floor(
    (base * multiplierBps * HERO_RARITY_MULTIPLIER_BPS[rarity]) / BPS_SQUARED,
  );
  return Math.max(1, scaled + potential);
}

export function calculateHeroStats(input: HeroStatInput): HeroComputedStats {
  assertStat(input.baseHp, "baseHp");
  assertStat(input.baseAttack, "baseAttack");
  assertStat(input.baseDefense, "baseDefense", true);
  assertStat(input.baseSpeed, "baseSpeed", true);

  const potential = {
    hp: input.potential?.hp ?? 0,
    attack: input.potential?.attack ?? 0,
    defense: input.potential?.defense ?? 0,
    speed: input.potential?.speed ?? 0,
  };
  for (const [key, value] of Object.entries(potential)) {
    assertStat(value, `potential.${key}`, true);
  }

  const multiplier = tierLevelMultiplierBps(input.tier ?? 1, input.level);
  return {
    hp: scale(input.baseHp, multiplier, input.rarity, potential.hp),
    attack: scale(input.baseAttack, multiplier, input.rarity, potential.attack),
    defense: scale(Math.max(1, input.baseDefense), multiplier, input.rarity, potential.defense),
    speed: scale(Math.max(1, input.baseSpeed), multiplier, input.rarity, potential.speed),
  };
}

export function retainHeroPotential(
  stats: HeroComputedStats,
  retainedPotentialBps: number,
): HeroStatPotential {
  if (
    !Number.isInteger(retainedPotentialBps) ||
    retainedPotentialBps < 0 ||
    retainedPotentialBps > BPS
  ) {
    throw new Error("retainedPotentialBps must be between 0 and 10000");
  }

  return {
    hp: Math.floor((stats.hp * retainedPotentialBps) / BPS),
    attack: Math.floor((stats.attack * retainedPotentialBps) / BPS),
    defense: Math.floor((stats.defense * retainedPotentialBps) / BPS),
    speed: Math.floor((stats.speed * retainedPotentialBps) / BPS),
  };
}
