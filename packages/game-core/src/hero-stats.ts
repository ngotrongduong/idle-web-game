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

function scale(base: number, level: number, rarity: HeroStatRarity, potential: number): number {
  const scaled = Math.floor(
    (base * levelMultiplierBps(level) * HERO_RARITY_MULTIPLIER_BPS[rarity]) / BPS_SQUARED,
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

  return {
    hp: scale(input.baseHp, input.level, input.rarity, potential.hp),
    attack: scale(input.baseAttack, input.level, input.rarity, potential.attack),
    defense: scale(Math.max(1, input.baseDefense), input.level, input.rarity, potential.defense),
    speed: scale(Math.max(1, input.baseSpeed), input.level, input.rarity, potential.speed),
  };
}
