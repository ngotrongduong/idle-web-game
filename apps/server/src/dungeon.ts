import type {
  BattleRulesSnapshot,
  BattleUnitSnapshot,
  DungeonCycleSample,
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
  fnv1a32,
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

export function deriveWaveSeed(rootSeed: number, wave: number): number {
  return (rootSeed + Math.imul(wave, 0x9e3779b9)) >>> 0;
}

/**
 * The run seed depends only on who fights where under which rules, so stopping and restarting
 * with the same team reproduces the same samples (no rerolling until the boss happens to die).
 */
export function deriveRunSeed(input: {
  playerId: string;
  dungeonId: string;
  allies: readonly BattleUnitSnapshot[];
  rules: BattleRulesSnapshot;
}): number {
  const allies = [...input.allies].sort((left, right) => (left.id < right.id ? -1 : 1));
  return Number.parseInt(
    fnv1a32(JSON.stringify([input.playerId, input.dungeonId, allies, input.rules])),
    16,
  );
}

/** Sample 0 uses the run seed itself, so the persisted replay is exactly sample 0. */
export function deriveSampleSeed(runSeed: number, sample: number): number {
  return sample === 0 ? runSeed : (runSeed ^ Math.imul(sample, 0x85ebca6b)) >>> 0;
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
  return simulateCycleWaves(input.dungeonId, allies, input.seed);
}

/** Plays one cycle and stops at the first wave that is not won: later waves are never reached. */
function simulateCycleWaves(
  dungeonId: string,
  allies: readonly BattleUnitSnapshot[],
  seed: number,
): DungeonWaveReplay[] {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === dungeonId)!;
  const waves: DungeonWaveReplay[] = [];
  for (let wave = 1; wave <= dungeon.waveCount; wave += 1) {
    const replay = simulateDungeonWave(dungeonId, allies, seed, wave);
    waves.push(replay);
    if (replay.result !== "win") break;
  }
  return waves;
}

function simulateDungeonWave(
  dungeonId: string,
  allies: readonly BattleUnitSnapshot[],
  rootSeed: number,
  wave: number,
): DungeonWaveReplay {
  const waveSeed = deriveWaveSeed(rootSeed, wave);
  const selectedEnemies = enemiesForWave(dungeonId, wave);
  const enemies = enemyCombatantsForWave(dungeonId, wave);

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
}

const enemyRankById = new Map(foundationGameData.enemies.map((enemy) => [enemy.id, enemy.rank]));

export function cycleSampleFromWaves(waves: readonly DungeonWaveReplay[]): DungeonCycleSample {
  const kills = { normal: 0, elite: 0, boss: 0 };
  for (const wave of waves) {
    if (wave.result !== "win") continue;
    for (const enemy of wave.enemies) {
      const rank = enemyRankById.get(enemy.id);
      if (!rank) throw new Error(`Unknown enemy in dungeon replay: ${enemy.id}`);
      kills[rank] += 1;
    }
  }
  return {
    gold: waves.reduce((sum, wave) => sum + wave.rewardGold, 0),
    exp: waves.reduce((sum, wave) => sum + wave.rewardExp, 0),
    kills,
  };
}

/** docs/04 §6: idle rewards are the expected value of sampled cycles, not one lucky replay. */
export function sampleDungeonCycles(input: {
  heroes: Hero[];
  dungeonId: string;
  seed: number;
  samples: number;
  equipment?: readonly InventoryItem[];
}): { waves: DungeonWaveReplay[]; cycleSamples: DungeonCycleSample[] } {
  if (input.heroes.length === 0 || input.heroes.length > 4) {
    throw new Error("Dungeon cycle requires between one and four heroes");
  }
  const allies = input.heroes.map((hero) => heroToCombatant(hero, input.equipment ?? []));
  let displayed: DungeonWaveReplay[] = [];
  const cycleSamples = Array.from({ length: input.samples }, (_, sample) => {
    const waves = simulateCycleWaves(input.dungeonId, allies, deriveSampleSeed(input.seed, sample));
    if (sample === 0) displayed = waves;
    return cycleSampleFromWaves(waves);
  });
  return { waves: displayed, cycleSamples };
}
