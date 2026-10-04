import type { DungeonRun } from "@idle/api-contract";
import { idleConfig } from "@idle/game-data";
import { calculateIdleAccrual } from "@idle/game-core";

const SECOND_MS = 1_000;
const HOUR_MS = 60 * 60 * SECOND_MS;

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

  return {
    ...run,
    lastAccruedAt: new Date(accrual.nextAccruedAtMs).toISOString(),
    pendingCycles: run.pendingCycles + accrual.cycles,
    pendingGold: run.pendingGold + accrual.cycles * goldPerCycle,
    pendingExpPerHero: run.pendingExpPerHero + accrual.cycles * expPerHeroPerCycle,
    completedCycles: run.completedCycles + accrual.cycles,
  };
}
