import {
  simulateWaveV2,
  type BattleResultV2,
  type BattleUnitStateV2,
  type CombatantV2,
} from "./battle-v2";
import type { BattleRules } from "./battle";
import { fnv1a32 } from "./hash";
import { SeededRng } from "./rng";

export type DungeonWaveV2 = {
  id: string;
  enemies: CombatantV2[];
};

export type DungeonWaveResultV2 = {
  waveId: string;
  seed: number;
  battle: BattleResultV2;
};

export type DungeonRunResultV2 = {
  rulesVersion: "dungeon-v2";
  result: "win" | "lose" | "draw";
  wavesAttempted: number;
  wavesCleared: number;
  waveResults: DungeonWaveResultV2[];
  finalAllies: BattleUnitStateV2[];
  hash: string;
};

function compareStateIds(
  left: BattleUnitStateV2,
  right: BattleUnitStateV2,
): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function serializeStates(states: BattleUnitStateV2[]): string {
  return [...states]
    .sort(compareStateIds)
    .map(
      (state) =>
        `${state.id},${state.currentHp},${state.mp},${state.shield}`,
    )
    .join(";");
}

function hashDungeonRun(
  result: DungeonRunResultV2["result"],
  waveResults: DungeonWaveResultV2[],
  finalAllies: BattleUnitStateV2[],
): string {
  const waves = waveResults
    .map((wave) => `${wave.waveId},${wave.seed},${wave.battle.hash}`)
    .join(";");

  return fnv1a32(
    `dungeon-v2|${result}|${waves}|${serializeStates(finalAllies)}`,
  );
}

export function simulateDungeonRunV2(input: {
  allies: CombatantV2[];
  waves: DungeonWaveV2[];
  seed: number;
  rules?: Partial<BattleRules>;
}): DungeonRunResultV2 {
  if (input.allies.length === 0) {
    throw new Error("simulateDungeonRunV2 requires at least one ally");
  }
  if (input.waves.length === 0) {
    throw new Error("simulateDungeonRunV2 requires at least one wave");
  }

  const waveIds = input.waves.map((wave) => wave.id);
  if (waveIds.some((id) => id.length === 0)) {
    throw new Error("Dungeon wave id is required");
  }
  if (new Set(waveIds).size !== waveIds.length) {
    throw new Error("Dungeon wave ids must be unique");
  }

  const seedLineage = new SeededRng(input.seed);
  const waveResults: DungeonWaveResultV2[] = [];
  let carry: BattleUnitStateV2[] | undefined;

  for (const wave of input.waves) {
    const waveSeed = seedLineage.nextUint32();
    const battle = simulateWaveV2({
      allies: input.allies,
      enemies: wave.enemies,
      seed: waveSeed,
      ...(input.rules === undefined ? {} : { rules: input.rules }),
      ...(carry === undefined ? {} : { initialAllies: carry }),
    });

    carry = battle.finalAllies;
    waveResults.push({
      waveId: wave.id,
      seed: waveSeed,
      battle,
    });

    if (battle.result !== "win") break;
  }

  const last = waveResults.at(-1)!;
  const completedAllWaves =
    waveResults.length === input.waves.length &&
    waveResults.every((wave) => wave.battle.result === "win");
  const result: DungeonRunResultV2["result"] = completedAllWaves
    ? "win"
    : last.battle.result;
  const finalAllies = last.battle.finalAllies;
  const wavesCleared = waveResults.filter(
    (wave) => wave.battle.result === "win",
  ).length;

  return {
    rulesVersion: "dungeon-v2",
    result,
    wavesAttempted: waveResults.length,
    wavesCleared,
    waveResults,
    finalAllies,
    hash: hashDungeonRun(result, waveResults, finalAllies),
  };
}
