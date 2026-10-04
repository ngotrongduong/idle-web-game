export type IdleAccrualInput = {
  lastAccruedAtMs: number;
  nowMs: number;
  cycleDurationMs: number;
  efficiencyBps: number;
  offlineCapMs: number;
};

export type IdleAccrualResult = {
  cycles: number;
  nextAccruedAtMs: number;
  discardedMs: number;
  wallCycleMs: number;
};

const BPS = 10_000;

export function calculateIdleAccrual(input: IdleAccrualInput): IdleAccrualResult {
  if (!Number.isFinite(input.lastAccruedAtMs) || !Number.isFinite(input.nowMs)) {
    throw new Error("Idle accrual timestamps must be finite");
  }
  if (!Number.isInteger(input.cycleDurationMs) || input.cycleDurationMs <= 0) {
    throw new Error("Idle cycle duration must be a positive integer");
  }
  if (
    !Number.isInteger(input.efficiencyBps) ||
    input.efficiencyBps <= 0 ||
    input.efficiencyBps > BPS
  ) {
    throw new Error("Idle efficiency must be between 1 and 10000 bps");
  }
  if (!Number.isInteger(input.offlineCapMs) || input.offlineCapMs <= 0) {
    throw new Error("Idle offline cap must be a positive integer");
  }

  const nowMs = Math.trunc(input.nowMs);
  const lastAccruedAtMs = Math.trunc(input.lastAccruedAtMs);
  const wallCycleMs = Math.ceil((input.cycleDurationMs * BPS) / input.efficiencyBps);

  if (nowMs <= lastAccruedAtMs) {
    return {
      cycles: 0,
      nextAccruedAtMs: lastAccruedAtMs,
      discardedMs: 0,
      wallCycleMs,
    };
  }

  const capStartMs = nowMs - input.offlineCapMs;
  const windowStartMs = Math.max(lastAccruedAtMs, capStartMs);
  const discardedMs = Math.max(0, windowStartMs - lastAccruedAtMs);
  const elapsedMs = Math.max(0, nowMs - windowStartMs);
  const cycles = Math.floor(elapsedMs / wallCycleMs);

  return {
    cycles,
    nextAccruedAtMs: windowStartMs + cycles * wallCycleMs,
    discardedMs,
    wallCycleMs,
  };
}
