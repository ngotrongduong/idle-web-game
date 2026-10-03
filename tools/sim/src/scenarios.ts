import type { Combatant } from "@idle/game-core";
import { foundationGameData } from "@idle/game-data";

function toCombatant(input: {
  id: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}): Combatant {
  return {
    id: input.id,
    hp: input.hp,
    attack: input.attack,
    defense: input.defense,
    speed: input.speed,
  };
}

const sampleClassIds = [
  "bastion_keeper",
  "gale_marksman",
  "cinder_sage",
  "moon_mender",
] as const;

export const SAMPLE_TEAM: Combatant[] = sampleClassIds.map((classId) => {
  const heroClass = foundationGameData.classes.find(
    (entry) => entry.id === classId,
  );
  if (!heroClass) {
    throw new Error(`Missing sample class in game-data: ${classId}`);
  }

  return toCombatant({
    id: heroClass.id,
    hp: heroClass.baseHp,
    attack: heroClass.baseAttack,
    defense: heroClass.baseDefense,
    speed: heroClass.baseSpeed,
  });
});

export const SAMPLE_ENCOUNTERS = foundationGameData.dungeons.map(
  (dungeon) => {
    const enemies = foundationGameData.enemies
      .filter((enemy) => enemy.dungeonId === dungeon.id)
      .map(toCombatant);

    if (enemies.length === 0) {
      throw new Error(`Dungeon ${dungeon.id} has no enemies`);
    }

    return {
      id: dungeon.id,
      label: dungeon.nameEn,
      recommendedLevel: dungeon.recommendedLevel,
      enemies,
    };
  },
);
