import { SeededRng } from "./rng.js";

export type LootRank = "normal" | "elite" | "boss";

export type LootRuleInput = {
  dungeonId: string;
  rank: LootRank;
  materialId: string;
  chanceBps: number;
  minQty: number;
  maxQty: number;
};

export type LootKill = {
  dungeonId: string;
  rank: LootRank;
};

export type MaterialCounts = Record<string, number>;

function mix32(value: number): number {
  let z = value >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

/**
 * Seed for the loot rolls of one idle cycle. Independent from the per-wave battle seeds so the
 * same run produces different (but reproducible) drops every cycle.
 */
export function deriveCycleLootSeed(runSeed: number, cycleIndex: number): number {
  if (!Number.isInteger(runSeed) || !Number.isInteger(cycleIndex) || cycleIndex < 0) {
    throw new Error("runSeed and cycleIndex must be integers and cycleIndex non-negative");
  }
  return mix32((mix32(runSeed ^ 0x6c8e9cf5) + Math.imul(cycleIndex + 1, 0x9e3779b9)) >>> 0);
}

/**
 * Rolls loot for a list of kills in a fixed order (kills, then rules in table order), so the
 * result depends only on the inputs and the seed.
 */
export function rollLoot(
  kills: readonly LootKill[],
  rules: readonly LootRuleInput[],
  seed: number,
): MaterialCounts {
  const rng = new SeededRng(seed);
  const drops: MaterialCounts = {};

  for (const kill of kills) {
    for (const rule of rules) {
      if (rule.dungeonId !== kill.dungeonId || rule.rank !== kill.rank) continue;
      if (rng.nextInt(10_000) >= rule.chanceBps) continue;
      const qty = rule.minQty + rng.nextInt(rule.maxQty - rule.minQty + 1);
      drops[rule.materialId] = (drops[rule.materialId] ?? 0) + qty;
    }
  }

  return drops;
}

export function mergeMaterialCounts(...parts: readonly MaterialCounts[]): MaterialCounts {
  const merged: MaterialCounts = {};
  for (const part of parts) {
    for (const [materialId, qty] of Object.entries(part)) {
      if (!Number.isInteger(qty) || qty < 0) {
        throw new Error(`Material quantity for ${materialId} must be a non-negative integer`);
      }
      if (qty === 0) continue;
      merged[materialId] = (merged[materialId] ?? 0) + qty;
    }
  }
  return merged;
}

/** Sum the loot of consecutive idle cycles [firstCycleIndex, firstCycleIndex + cycles). */
export function rollIdleCycleLoot(input: {
  runSeed: number;
  firstCycleIndex: number;
  cycles: number;
  kills: readonly LootKill[];
  rules: readonly LootRuleInput[];
}): MaterialCounts {
  if (!Number.isInteger(input.cycles) || input.cycles < 0) {
    throw new Error("cycles must be a non-negative integer");
  }
  let total: MaterialCounts = {};
  for (let offset = 0; offset < input.cycles; offset += 1) {
    const seed = deriveCycleLootSeed(input.runSeed, input.firstCycleIndex + offset);
    total = mergeMaterialCounts(total, rollLoot(input.kills, input.rules, seed));
  }
  return total;
}
