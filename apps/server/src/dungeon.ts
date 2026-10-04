import { randomBytes } from "node:crypto";
import type {
  BattleUnitSnapshot,
  DungeonWaveReplay,
  Hero,
  InventoryItem,
} from "@idle/api-contract";
import {
  battleConfig,
  combatantSetup,
  currentBattleRules,
  equipmentStatValue,
  foundationGameData,
} from "@idle/game-data";
import {
  buildEnemyCombatant,
  buildHeroCombatant,
  selectWaveEnemies,
  simulateWave,
  type BattleRules,
  type Combatant,
  type CombatantSetup,
} from "@idle/game-core";

/** Rules snapshotted into every new run; runs keep their own copy so later tuning never rewrites history. */
export const CURRENT_DUNGEON_BATTLE_RULES: BattleRules = currentBattleRules;

export const COMBATANT_SETUP: CombatantSetup = combatantSetup;

export function createDungeonSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

export function deriveWaveSeed(rootSeed: number, wave: number): number {
  return (rootSeed + Math.imul(wave, 0x9e3779b9)) >>> 0;
}

export function heroToCombatant(
  hero: Hero,
  equipment: readonly InventoryItem[] = [],
): BattleUnitSnapshot {
  const heroClass = foundationGameData.classes.find((entry) => entry.id === hero.classId);
  if (!heroClass) {
    throw new Error(`Unknown hero class: ${hero.classId}`);
  }

  const family = foundationGameData.classFamilies.find((entry) => entry.id === heroClass.familyId);
  if (!family) {
    throw new Error(`Unknown class family: ${heroClass.familyId}`);
  }

  const equipped = equipment.filter((item) => item.equippedHeroId === hero.id);
  const equipmentStat = (stat: "attack" | "defense") =>
    equipped.reduce((sum, item) => {
      const spec = foundationGameData.items.find((entry) => entry.id === item.itemId);
      return sum + (spec ? equipmentStatValue(spec[stat], item.qualityBps, item.enhanceLevel) : 0);
    }, 0);

  return buildHeroCombatant(
    {
      id: hero.id,
      heroClass,
      archetype: family.archetype,
      level: hero.level,
      rarity: hero.rarity,
      ...(hero.potential ? { potential: hero.potential } : {}),
      equipmentAttack: equipmentStat("attack"),
      equipmentDefense: equipmentStat("defense"),
    },
    COMBATANT_SETUP,
  );
}

export function enemiesForWave(dungeonId: string, wave: number) {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon: ${dungeonId}`);
  const dungeonEnemies = foundationGameData.enemies.filter(
    (entry) => entry.dungeonId === dungeonId,
  );
  return selectWaveEnemies(dungeonEnemies, dungeon.waveCount, wave);
}

export function enemyCombatantsForWave(dungeonId: string, wave: number): BattleUnitSnapshot[] {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon: ${dungeonId}`);
  const multiplier = battleConfig.enemyStatMultiplierBps[dungeonId]!;
  return enemiesForWave(dungeonId, wave).map((enemy) =>
    buildEnemyCombatant(enemy, dungeon.recommendedLevel, multiplier),
  );
}

export function simulateDungeonCycle(input: {
  heroes: Hero[];
  dungeonId: string;
  seed: number;
  equipment?: readonly InventoryItem[];
}): DungeonWaveReplay[] {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === input.dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon: ${input.dungeonId}`);
  if (input.heroes.length === 0 || input.heroes.length > 4) {
    throw new Error("Dungeon cycle requires between one and four heroes");
  }

  const allies = input.heroes.map((hero) => heroToCombatant(hero, input.equipment ?? []));

  return Array.from({ length: dungeon.waveCount }, (_, index) => {
    const wave = index + 1;
    const waveSeed = deriveWaveSeed(input.seed, wave);
    const selectedEnemies = enemiesForWave(input.dungeonId, wave);
    const enemies = enemyCombatantsForWave(input.dungeonId, wave);

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
