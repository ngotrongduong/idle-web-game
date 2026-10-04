import { foundationGameData, type GameData } from "@idle/game-data";
import { scaleStat, type Combatant } from "@idle/game-core";

const STAT_GROWTH_BPS_PER_LEVEL = 400;

export type GeneratedEncounter = {
  id: string;
  label: string;
  dungeonId: string;
  wave: number;
  allies: Combatant[];
  enemies: Combatant[];
  rewardGold: number;
  rewardExp: number;
};

function classTierForLevel(level: number): number {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}

export function buildProgressionTeam(
  level: number,
  data: GameData = foundationGameData,
): Combatant[] {
  if (!Number.isInteger(level) || level <= 0) {
    throw new Error("level must be a positive integer");
  }

  const tier = classTierForLevel(level);

  return data.classFamilies.map((family) => {
    const heroClass = data.classes.find(
      (entry) => entry.familyId === family.id && entry.tier === tier,
    );
    if (!heroClass) {
      throw new Error(`No tier ${tier} class found for family ${family.id}`);
    }

    return {
      id: heroClass.id,
      hp: scaleStat(heroClass.baseHp, level, STAT_GROWTH_BPS_PER_LEVEL),
      attack: scaleStat(heroClass.baseAttack, level, STAT_GROWTH_BPS_PER_LEVEL),
      defense: Math.max(
        0,
        scaleStat(Math.max(1, heroClass.baseDefense), level, STAT_GROWTH_BPS_PER_LEVEL),
      ),
      speed: heroClass.baseSpeed,
      critBps: family.archetype === "ranged" ? 1_500 : 1_000,
      familyId: family.id,
      targeting: heroClass.targeting,
      ultimatePowerBps: heroClass.ultimatePowerBps,
      ultimateKind: heroClass.ultimateKind,
      ultimateTargeting: heroClass.ultimateTargeting,
    };
  });
}

function toCombatant(enemy: GameData["enemies"][number]): Combatant {
  return {
    id: enemy.id,
    hp: enemy.hp,
    attack: enemy.attack,
    defense: enemy.defense,
    speed: enemy.speed,
  };
}

export function buildDungeonWave(
  dungeonId: string,
  wave: number,
  data: GameData = foundationGameData,
): GeneratedEncounter {
  const dungeon = data.dungeons.find((entry) => entry.id === dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon: ${dungeonId}`);
  if (!Number.isInteger(wave) || wave < 1 || wave > dungeon.waveCount) {
    throw new Error(`Wave must be between 1 and ${dungeon.waveCount} for ${dungeonId}`);
  }

  const dungeonEnemies = data.enemies.filter((entry) => entry.dungeonId === dungeonId);
  const normals = dungeonEnemies.filter((entry) => entry.rank === "normal");
  const elite = dungeonEnemies.find((entry) => entry.rank === "elite");
  const boss = dungeonEnemies.find((entry) => entry.rank === "boss");

  if (normals.length < 2 || !elite || !boss) {
    throw new Error(`Dungeon ${dungeonId} does not have a complete enemy set`);
  }

  let selected: typeof dungeonEnemies;
  if (wave === dungeon.waveCount) {
    selected = [boss];
  } else if (wave === dungeon.waveCount - 1) {
    selected = [normals[(wave - 1) % normals.length]!, elite];
  } else {
    selected = [normals[(wave - 1) % normals.length]!, normals[wave % normals.length]!];
  }

  return {
    id: `${dungeonId}_wave_${wave}`,
    label: `${dungeon.nameEn} — wave ${wave}`,
    dungeonId,
    wave,
    allies: buildProgressionTeam(dungeon.recommendedLevel, data),
    enemies: selected.map(toCombatant),
    rewardGold: selected.reduce((sum, enemy) => sum + enemy.rewardGold, 0),
    rewardExp: selected.reduce((sum, enemy) => sum + enemy.rewardExp, 0),
  };
}

export const SAMPLE_ENCOUNTERS: GeneratedEncounter[] = foundationGameData.dungeons.map((dungeon) =>
  buildDungeonWave(dungeon.id, dungeon.waveCount - 1),
);
