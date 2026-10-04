import { battleConfig, combatantSetup, foundationGameData, type GameData } from "@idle/game-data";
import {
  buildEnemyCombatant,
  buildHeroCombatant,
  selectWaveEnemies,
  type Combatant,
  type HeroStatRarity,
} from "@idle/game-core";

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

/** Maps a combat level (1–30, same scale as enemy levels) to the class tier and in-tier level. */
export function tierAndLevelForCombatLevel(combatLevel: number): { tier: number; level: number } {
  if (!Number.isInteger(combatLevel) || combatLevel <= 0 || combatLevel > 30) {
    throw new Error("combat level must be an integer from 1 to 30");
  }
  if (combatLevel <= 10) return { tier: 1, level: combatLevel };
  if (combatLevel <= 20) return { tier: 2, level: Math.round(((combatLevel - 10) * 19) / 10) + 1 };
  return { tier: 3, level: Math.round(((combatLevel - 20) * 29) / 10) + 1 };
}

/** A team built with the server's own formulas (docs/03 §2, battle.json). */
export function buildTeam(
  members: Array<{ classId: string; level: number; rarity?: HeroStatRarity }>,
  data: GameData = foundationGameData,
): Combatant[] {
  return members.map((member, index) => {
    const heroClass = data.classes.find((entry) => entry.id === member.classId);
    if (!heroClass) throw new Error(`Unknown class ${member.classId}`);
    const family = data.classFamilies.find((entry) => entry.id === heroClass.familyId);
    if (!family) throw new Error(`Unknown family ${heroClass.familyId}`);
    return buildHeroCombatant(
      {
        id: `${member.classId}_${index + 1}`,
        heroClass,
        archetype: family.archetype,
        level: member.level,
        rarity: member.rarity ?? "common",
      },
      combatantSetup,
    );
  });
}

export function buildProgressionTeam(
  combatLevel: number,
  data: GameData = foundationGameData,
): Combatant[] {
  const { tier, level } = tierAndLevelForCombatLevel(combatLevel);
  return buildTeam(
    data.classFamilies.map((family) => {
      const heroClass = data.classes.find(
        (entry) => entry.familyId === family.id && entry.tier === tier,
      );
      if (!heroClass) throw new Error(`No tier ${tier} class found for family ${family.id}`);
      return { classId: heroClass.id, level };
    }),
    data,
  );
}

export function buildWaveEnemies(
  dungeonId: string,
  wave: number,
  data: GameData = foundationGameData,
) {
  const dungeon = data.dungeons.find((entry) => entry.id === dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon: ${dungeonId}`);
  const selected = selectWaveEnemies(
    data.enemies.filter((entry) => entry.dungeonId === dungeonId),
    dungeon.waveCount,
    wave,
  );
  const multiplier = battleConfig.enemyStatMultiplierBps[dungeonId]!;
  return {
    dungeon,
    selected,
    enemies: selected.map((enemy) =>
      buildEnemyCombatant(enemy, dungeon.recommendedLevel, multiplier),
    ),
  };
}

export function buildDungeonWave(
  dungeonId: string,
  wave: number,
  data: GameData = foundationGameData,
): GeneratedEncounter {
  const { dungeon, selected, enemies } = buildWaveEnemies(dungeonId, wave, data);
  return {
    id: `${dungeonId}_wave_${wave}`,
    label: `${dungeon.nameEn} — wave ${wave}`,
    dungeonId,
    wave,
    allies: buildProgressionTeam(dungeon.recommendedLevel, data),
    enemies,
    rewardGold: selected.reduce((sum, enemy) => sum + enemy.rewardGold, 0),
    rewardExp: selected.reduce((sum, enemy) => sum + enemy.rewardExp, 0),
  };
}

export const SAMPLE_ENCOUNTERS: GeneratedEncounter[] = foundationGameData.dungeons.map((dungeon) =>
  buildDungeonWave(dungeon.id, dungeon.waveCount - 1),
);
