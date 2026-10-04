import type { DungeonCycleSample, DungeonRun, MaterialBalance } from "@idle/api-contract";
import { foundationGameData, idleConfig, lootConfig } from "@idle/game-data";
import {
  calculateIdleAccrual,
  deriveCycleLootSeed,
  mergeMaterialCounts,
  rollLoot,
  type LootKill,
  type MaterialCounts,
} from "@idle/game-core";

const SECOND_MS = 1_000;
const HOUR_MS = 60 * 60 * SECOND_MS;

const enemyRankById = new Map(foundationGameData.enemies.map((enemy) => [enemy.id, enemy.rank]));

export function materialBalancesToCounts(balances: readonly MaterialBalance[]): MaterialCounts {
  return mergeMaterialCounts(
    ...balances.map((entry) => ({ [entry.materialId]: entry.qty }) as MaterialCounts),
  );
}

export function materialCountsToBalances(counts: MaterialCounts): MaterialBalance[] {
  return Object.entries(counts)
    .filter(([, qty]) => qty > 0)
    .map(([materialId, qty]) => ({ materialId, qty }))
    .sort((left, right) => left.materialId.localeCompare(right.materialId));
}

/**
 * Samples that idle cycles pay out. Runs started before sampling existed fall back to their single
 * replay, cut at the first lost wave (waves after a loss are never reached, so they never pay).
 */
export function runCycleSamples(
  run: Pick<DungeonRun, "waves" | "cycleSamples">,
): DungeonCycleSample[] {
  if (run.cycleSamples && run.cycleSamples.length > 0) return run.cycleSamples;

  const reached = [];
  for (const wave of run.waves) {
    reached.push(wave);
    if (wave.result !== "win") break;
  }
  const kills = { normal: 0, elite: 0, boss: 0 };
  for (const wave of reached) {
    if (wave.result !== "win") continue;
    for (const enemy of wave.enemies) {
      const rank = enemyRankById.get(enemy.id);
      if (!rank) throw new Error(`Unknown enemy in dungeon replay: ${enemy.id}`);
      kills[rank] += 1;
    }
  }
  return [
    {
      gold: reached.reduce((sum, wave) => sum + (wave.result === "win" ? wave.rewardGold : 0), 0),
      exp: reached.reduce((sum, wave) => sum + (wave.result === "win" ? wave.rewardExp : 0), 0),
      kills,
    },
  ];
}

/** Kill list in a fixed order (normals, elites, boss) because loot rolls follow kill order. */
export function sampleKills(dungeonId: string, sample: DungeonCycleSample): LootKill[] {
  return (["normal", "elite", "boss"] as const).flatMap((rank) =>
    Array.from({ length: sample.kills[rank] }, () => ({ dungeonId, rank })),
  );
}

/** Rewards for cycles [firstCycleIndex, firstCycleIndex + cycles): cycle c pays sample c % N. */
export function cycleRewards(
  run: Pick<DungeonRun, "dungeonId" | "seed" | "waves" | "cycleSamples">,
  firstCycleIndex: number,
  cycles: number,
): { gold: number; exp: number; loot: MaterialCounts; bossKills: number } {
  const samples = runCycleSamples(run);
  let gold = 0;
  let exp = 0;
  let bossKills = 0;
  let loot: MaterialCounts = {};
  for (let cycle = firstCycleIndex; cycle < firstCycleIndex + cycles; cycle += 1) {
    const sample = samples[cycle % samples.length]!;
    gold += sample.gold;
    exp += sample.exp;
    bossKills += sample.kills.boss;
    loot = mergeMaterialCounts(
      loot,
      rollLoot(
        sampleKills(run.dungeonId, sample),
        lootConfig.rules,
        deriveCycleLootSeed(run.seed, cycle),
      ),
    );
  }
  return { gold, exp, loot, bossKills };
}

export function accrueDungeonRunRewards(run: DungeonRun, now = new Date()): DungeonRun {
  if (run.status !== "active") return run;

  const previousAccruedAtMs = new Date(run.lastAccruedAt).getTime();
  const accrual = calculateIdleAccrual({
    lastAccruedAtMs: previousAccruedAtMs,
    nowMs: now.getTime(),
    cycleDurationMs: idleConfig.cycleDurationSeconds * SECOND_MS,
    efficiencyBps: idleConfig.offlineEfficiencyBps,
    offlineCapMs: idleConfig.offlineCapHours * HOUR_MS,
  });

  if (accrual.cycles === 0 && accrual.nextAccruedAtMs === previousAccruedAtMs) {
    return run;
  }

  const rewards = cycleRewards(run, run.completedCycles, accrual.cycles);

  return {
    ...run,
    lastAccruedAt: new Date(accrual.nextAccruedAtMs).toISOString(),
    pendingCycles: run.pendingCycles + accrual.cycles,
    pendingGold: run.pendingGold + rewards.gold,
    pendingExpPerHero: run.pendingExpPerHero + rewards.exp,
    pendingMaterials: materialCountsToBalances(
      mergeMaterialCounts(materialBalancesToCounts(run.pendingMaterials), rewards.loot),
    ),
    completedCycles: run.completedCycles + accrual.cycles,
  };
}
