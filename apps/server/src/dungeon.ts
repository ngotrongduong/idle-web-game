import { randomBytes } from "node:crypto";
import type { BattleUnitSnapshot, DungeonWaveReplay, Hero } from "@idle/api-contract";
import { foundationGameData } from "@idle/game-data";
import {
  DEFAULT_BATTLE_RULES,
  scaleStat,
  simulateWave,
  type BattleRules,
  type Combatant,
} from "@idle/game-core";

const STAT_GROWTH_BPS_PER_LEVEL = 400;
const BPS = 10_000;
const RARITY_MULTIPLIER_BPS = {
  common: 10_000,
  elite: 10_800,
  rare: 11_800,
  legendary: 13_000,
} as const;

const FAMILY_ADVANTAGE = Object.fromEntries(
  foundationGameData.classFamilies.map((family) => [family.id, family.advantageFamilyId]),
);

export const CURRENT_DUNGEON_BATTLE_RULES: BattleRules = {
  ...DEFAULT_BATTLE_RULES,
  familyAdvantage: FAMILY_ADVANTAGE,
};

function applyBps(value: number, multiplierBps: number): number {
  return Math.max(1, Math.floor((value * multiplierBps) / BPS));
}

export function createDungeonSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

export function deriveWaveSeed(rootSeed: number, wave: number): number {
  return (rootSeed + Math.imul(wave, 0x9e3779b9)) >>> 0;
}

export function heroToCombatant(hero: Hero): BattleUnitSnapshot {
  const heroClass = foundationGameData.classes.find((entry) => entry.id === hero.classId);
  if (!heroClass) {
    throw new Error(`Unknown hero class: ${hero.classId}`);
  }

  const family = foundationGameData.classFamilies.find((entry) => entry.id === heroClass.familyId);
  if (!family) {
    throw new Error(`Unknown class family: ${heroClass.familyId}`);
  }

  const rarityBps = RARITY_MULTIPLIER_BPS[hero.rarity];
  return {
    id: hero.id,
    hp: applyBps(scaleStat(heroClass.baseHp, hero.level, STAT_GROWTH_BPS_PER_LEVEL), rarityBps),
    attack: applyBps(
      scaleStat(heroClass.baseAttack, hero.level, STAT_GROWTH_BPS_PER_LEVEL),
      rarityBps,
    ),
    defense: applyBps(
      scaleStat(Math.max(1, heroClass.baseDefense), hero.level, STAT_GROWTH_BPS_PER_LEVEL),
      rarityBps,
    ),
    speed: heroClass.baseSpeed,
    critBps: family.archetype === "ranged" ? 1_500 : 1_000,
    familyId: family.id,
    targeting: heroClass.targeting,
    ultimatePowerBps: heroClass.ultimatePowerBps,
    ultimateKind: heroClass.ultimateKind,
    ultimateTargeting: heroClass.ultimateTargeting,
  };
}

function enemyToCombatant(enemy: (typeof foundationGameData.enemies)[number]): BattleUnitSnapshot {
  return {
    id: enemy.id,
    hp: enemy.hp,
    attack: enemy.attack,
    defense: enemy.defense,
    speed: enemy.speed,
  };
}

function enemiesForWave(dungeonId: string, wave: number) {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon: ${dungeonId}`);

  const enemies = foundationGameData.enemies.filter((entry) => entry.dungeonId === dungeonId);
  const normal = enemies.filter((entry) => entry.rank === "normal");
  const elite = enemies.find((entry) => entry.rank === "elite");
  const boss = enemies.find((entry) => entry.rank === "boss");

  if (normal.length < 2 || !elite || !boss) {
    throw new Error(`Dungeon ${dungeonId} does not have a complete enemy set`);
  }

  if (wave === dungeon.waveCount) return [boss];
  if (wave === dungeon.waveCount - 1) {
    return [normal[(wave - 1) % normal.length]!, elite];
  }
  return [normal[(wave - 1) % normal.length]!, normal[wave % normal.length]!];
}

export function simulateDungeonCycle(input: {
  heroes: Hero[];
  dungeonId: string;
  seed: number;
}): DungeonWaveReplay[] {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === input.dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon: ${input.dungeonId}`);
  if (input.heroes.length === 0 || input.heroes.length > 4) {
    throw new Error("Dungeon cycle requires between one and four heroes");
  }

  const allies = input.heroes.map(heroToCombatant);

  return Array.from({ length: dungeon.waveCount }, (_, index) => {
    const wave = index + 1;
    const waveSeed = deriveWaveSeed(input.seed, wave);
    const selectedEnemies = enemiesForWave(input.dungeonId, wave);
    const enemies = selectedEnemies.map(enemyToCombatant);

    const result = simulateWave({
      allies: allies as Combatant[],
      enemies: enemies as Combatant[],
      seed: waveSeed,
      rules: CURRENT_DUNGEON_BATTLE_RULES,
    });

    const won = result.result === "win";
    return {
      wave,
      seed: waveSeed,
      result: result.result,
      turns: result.turns,
      hash: result.hash,
      allies: allies.map((unit) => ({ ...unit })),
      enemies: enemies.map((unit) => ({ ...unit })),
      rewardGold: won ? selectedEnemies.reduce((sum, enemy) => sum + enemy.rewardGold, 0) : 0,
      rewardExp: won ? selectedEnemies.reduce((sum, enemy) => sum + enemy.rewardExp, 0) : 0,
    };
  });
}
