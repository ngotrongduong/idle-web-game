import {
  simulateDungeonRunV2,
  type CombatantV2,
  type DungeonWaveV2,
} from "@idle/game-core";
import { foundationGameData } from "@idle/game-data";
import { SAMPLE_TEAM, toCombatant } from "./scenarios";
import { mean, percentile } from "./stats";

export type DungeonSimulationSummary = {
  rulesVersion: "dungeon-v2";
  dungeonId: string;
  label: string;
  runs: number;
  completions: number;
  completionRate: number;
  averageWavesCleared: number;
  averageTurns: number;
  p90Turns: number;
};

function instantiateEnemy(
  base: CombatantV2,
  position: number,
): CombatantV2 {
  return {
    ...base,
    id: `${base.id}__${position + 1}`,
  };
}

function buildDungeonWaves(dungeonId: string): DungeonWaveV2[] {
  return foundationGameData.waves
    .filter((wave) => wave.dungeonId === dungeonId)
    .sort((left, right) => left.waveIndex - right.waveIndex)
    .map((wave) => {
      const enemies: CombatantV2[] = wave.enemyIds.map(
        (enemyId, position) => {
          const enemy = foundationGameData.enemies.find(
            (entry) => entry.id === enemyId,
          );
          if (!enemy) {
            throw new Error(
              `Missing enemy ${enemyId} for ${dungeonId} wave ${wave.waveIndex}`,
            );
          }
          return instantiateEnemy(toCombatant(enemy), position);
        },
      );

      if (wave.bossId) {
        const boss = foundationGameData.bosses.find(
          (entry) => entry.id === wave.bossId,
        );
        if (!boss) {
          throw new Error(
            `Missing boss ${wave.bossId} for ${dungeonId}`,
          );
        }
        enemies.push(toCombatant(boss));
      }

      return {
        id: `${dungeonId}_wave_${wave.waveIndex}`,
        enemies,
      };
    });
}

export const SAMPLE_DUNGEONS = foundationGameData.dungeons.map(
  (dungeon) => ({
    id: dungeon.id,
    label: dungeon.nameEn,
    waves: buildDungeonWaves(dungeon.id),
  }),
);

export function runDungeonSimulation(input: {
  runs: number;
  seedBase?: number;
  dungeonId?: string;
}): DungeonSimulationSummary[] {
  if (!Number.isInteger(input.runs) || input.runs <= 0) {
    throw new Error("runs must be a positive integer");
  }

  const dungeons = input.dungeonId
    ? SAMPLE_DUNGEONS.filter(
        (dungeon) => dungeon.id === input.dungeonId,
      )
    : SAMPLE_DUNGEONS;

  if (dungeons.length === 0) {
    throw new Error(`unknown dungeon: ${input.dungeonId}`);
  }

  const seedBase = input.seedBase ?? 1;

  return dungeons.map((dungeon, dungeonIndex) => {
    let completions = 0;
    const wavesCleared: number[] = [];
    const totalTurns: number[] = [];

    for (let run = 0; run < input.runs; run += 1) {
      const result = simulateDungeonRunV2({
        allies: SAMPLE_TEAM,
        waves: dungeon.waves,
        seed: seedBase + dungeonIndex * 1_000_000 + run,
      });

      if (result.result === "win") completions += 1;
      wavesCleared.push(result.wavesCleared);
      totalTurns.push(
        result.waveResults.reduce(
          (sum, wave) => sum + wave.battle.turns,
          0,
        ),
      );
    }

    return {
      rulesVersion: "dungeon-v2",
      dungeonId: dungeon.id,
      label: dungeon.label,
      runs: input.runs,
      completions,
      completionRate: completions / input.runs,
      averageWavesCleared: mean(wavesCleared),
      averageTurns: mean(totalTurns),
      p90Turns: percentile(totalTurns, 0.9),
    };
  });
}
