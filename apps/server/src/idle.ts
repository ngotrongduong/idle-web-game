import type { DungeonRun, MaterialBalance } from "@idle/api-contract";
import { foundationGameData, idleConfig, lootConfig } from "@idle/game-data";
import {
  calculateIdleAccrual,
  mergeMaterialCounts,
  rollIdleCycleLoot,
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

/** Enemies defeated in one cycle: only won waves count, mirroring gold and EXP rewards. */
export function dungeonRunKills(run: Pick<DungeonRun, "dungeonId" | "waves">): LootKill[] {
  return run.waves
    .filter((wave) => wave.result === "win")
    .flatMap((wave) =>
      wave.enemies.map((enemy) => {
        const rank = enemyRankById.get(enemy.id);
        if (!rank) throw new Error(`Unknown enemy in dungeon replay: ${enemy.id}`);
        return { dungeonId: run.dungeonId, rank };
      }),
    );
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

  const goldPerCycle = run.waves.reduce((sum, wave) => sum + wave.rewardGold, 0);
  const expPerHeroPerCycle = run.waves.reduce((sum, wave) => sum + wave.rewardExp, 0);
  const cycleLoot = rollIdleCycleLoot({
    runSeed: run.seed,
    firstCycleIndex: run.completedCycles,
    cycles: accrual.cycles,
    kills: dungeonRunKills(run),
    rules: lootConfig.rules,
  });

  return {
    ...run,
    lastAccruedAt: new Date(accrual.nextAccruedAtMs).toISOString(),
    pendingCycles: run.pendingCycles + accrual.cycles,
    pendingGold: run.pendingGold + accrual.cycles * goldPerCycle,
    pendingExpPerHero: run.pendingExpPerHero + accrual.cycles * expPerHeroPerCycle,
    pendingMaterials: materialCountsToBalances(
      mergeMaterialCounts(materialBalancesToCounts(run.pendingMaterials), cycleLoot),
    ),
    completedCycles: run.completedCycles + accrual.cycles,
  };
}
