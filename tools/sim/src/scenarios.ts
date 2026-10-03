import type {
  CombatantV2,
  CombatSkill,
} from "@idle/game-core";
import { foundationGameData } from "@idle/game-data";

export function toCombatant(input: {
  id: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}): CombatantV2 {
  return {
    id: input.id,
    hp: input.hp,
    attack: input.attack,
    defense: input.defense,
    speed: input.speed,
  };
}

function toHeroCombatant(classId: string): CombatantV2 {
  const heroClass = foundationGameData.classes.find(
    (entry) => entry.id === classId,
  );
  if (!heroClass) {
    throw new Error(`Missing sample class in game-data: ${classId}`);
  }

  const skill = foundationGameData.skills.find(
    (entry) => entry.classId === classId,
  );
  if (!skill) {
    throw new Error(`Missing sample skill in game-data: ${classId}`);
  }

  const ult: CombatSkill = {
    id: skill.ultId,
    effect: skill.effect,
    target: skill.target,
    powerBps: skill.powerBps,
  };

  return {
    id: heroClass.id,
    hp: heroClass.baseHp,
    attack: heroClass.baseAttack,
    defense: heroClass.baseDefense,
    speed: heroClass.baseSpeed,
    ult,
    passive: {
      stat: skill.passiveStat,
      bonusBps: skill.passiveBonusBps,
    },
  };
}

const sampleClassIds = [
  "bastion_keeper",
  "gale_marksman",
  "cinder_sage",
  "moon_mender",
] as const;

export const SAMPLE_TEAM: CombatantV2[] =
  sampleClassIds.map(toHeroCombatant);

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
