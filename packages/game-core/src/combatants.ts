import type { Combatant, TargetingMode } from "./battle.js";
import {
  calculateHeroStats,
  combatLevel,
  type HeroStatPotential,
  type HeroStatRarity,
} from "./hero-stats.js";

/** Tunables that turn persisted hero/enemy data into battle units (game-data battle.json). */
export type CombatantSetup = {
  mpMax: number;
  startingMpBps: number;
  defaultCritBps: number;
  rangedCritBonusBps: number;
};

export type HeroClassStats = {
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  tier: number;
  familyId: string;
  targeting: TargetingMode;
  ultimateKind: "damage" | "heal";
  ultimateTargeting: TargetingMode;
  ultimatePowerBps: number;
};

export type EnemyStats = {
  id: string;
  rank: "normal" | "elite" | "boss";
  hp: number;
  attack: number;
  defense: number;
  speed: number;
};

export type EnemyStatMultiplierBps = { hp: number; attack: number; defense: number };

/** One function for the server snapshot, the sims and the tests, so balance numbers agree. */
export function buildHeroCombatant(
  input: {
    id: string;
    heroClass: HeroClassStats;
    archetype: string;
    level: number;
    rarity: HeroStatRarity;
    potential?: Partial<HeroStatPotential>;
    equipmentAttack?: number;
    equipmentDefense?: number;
  },
  setup: CombatantSetup,
): Combatant {
  const stats = calculateHeroStats({
    baseHp: input.heroClass.baseHp,
    baseAttack: input.heroClass.baseAttack,
    baseDefense: input.heroClass.baseDefense,
    baseSpeed: input.heroClass.baseSpeed,
    tier: input.heroClass.tier,
    level: input.level,
    rarity: input.rarity,
    ...(input.potential ? { potential: input.potential } : {}),
  });

  return {
    id: input.id,
    level: combatLevel(input.heroClass.tier, input.level),
    hp: stats.hp,
    attack: stats.attack + (input.equipmentAttack ?? 0),
    defense: stats.defense + (input.equipmentDefense ?? 0),
    speed: stats.speed,
    critBps: setup.defaultCritBps + (input.archetype === "ranged" ? setup.rangedCritBonusBps : 0),
    familyId: input.heroClass.familyId,
    targeting: input.heroClass.targeting,
    ultimatePowerBps: input.heroClass.ultimatePowerBps,
    ultimateKind: input.heroClass.ultimateKind,
    ultimateTargeting: input.heroClass.ultimateTargeting,
    startingMp: Math.floor((setup.mpMax * setup.startingMpBps) / 10_000),
  };
}

export function buildEnemyCombatant(
  enemy: EnemyStats,
  level: number,
  multiplier: EnemyStatMultiplierBps,
): Combatant {
  const scaleStat = (value: number, bps: number, minimum: number) =>
    Math.max(minimum, Math.floor((value * bps) / 10_000));
  return {
    id: enemy.id,
    level,
    hp: scaleStat(enemy.hp, multiplier.hp, 1),
    attack: scaleStat(enemy.attack, multiplier.attack, 1),
    defense: scaleStat(enemy.defense, multiplier.defense, 0),
    speed: enemy.speed,
  };
}

/** Waves 1..n−2 are two normals, wave n−1 is a normal + the elite, wave n is the boss. */
export function selectWaveEnemies<T extends { rank: EnemyStats["rank"] }>(
  dungeonEnemies: readonly T[],
  waveCount: number,
  wave: number,
): T[] {
  const normals = dungeonEnemies.filter((entry) => entry.rank === "normal");
  const elite = dungeonEnemies.find((entry) => entry.rank === "elite");
  const boss = dungeonEnemies.find((entry) => entry.rank === "boss");
  if (normals.length < 2 || !elite || !boss) {
    throw new Error("Dungeon needs at least 2 normal, 1 elite and 1 boss enemy");
  }
  if (!Number.isInteger(wave) || wave < 1 || wave > waveCount) {
    throw new Error(`wave must be between 1 and ${waveCount}`);
  }
  if (wave === waveCount) return [boss];
  if (wave === waveCount - 1) return [normals[(wave - 1) % normals.length]!, elite];
  return [normals[(wave - 1) % normals.length]!, normals[wave % normals.length]!];
}
