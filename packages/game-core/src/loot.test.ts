import { describe, expect, it } from "vitest";
import {
  deriveCycleLootSeed,
  mergeMaterialCounts,
  rollIdleCycleLoot,
  rollLoot,
  type LootRuleInput,
} from "./loot";

const rules: LootRuleInput[] = [
  { dungeonId: "d1", rank: "normal", materialId: "bark", chanceBps: 2_500, minQty: 1, maxQty: 1 },
  { dungeonId: "d1", rank: "boss", materialId: "bark", chanceBps: 10_000, minQty: 2, maxQty: 3 },
  { dungeonId: "d1", rank: "boss", materialId: "seal", chanceBps: 1_000, minQty: 1, maxQty: 1 },
  { dungeonId: "d2", rank: "normal", materialId: "scale", chanceBps: 10_000, minQty: 1, maxQty: 1 },
];

describe("loot", () => {
  it("is deterministic for the same seed and kills", () => {
    const kills = [
      { dungeonId: "d1", rank: "normal" as const },
      { dungeonId: "d1", rank: "boss" as const },
    ];
    expect(rollLoot(kills, rules, 42)).toEqual(rollLoot(kills, rules, 42));
  });

  it("only applies rules for the kill's dungeon and rank", () => {
    const drops = rollLoot([{ dungeonId: "d1", rank: "boss" }], rules, 7);
    expect(drops.scale).toBeUndefined();
    expect(drops.bark).toBeGreaterThanOrEqual(2);
    expect(drops.bark).toBeLessThanOrEqual(3);
  });

  it("returns no drops without kills", () => {
    expect(rollLoot([], rules, 1)).toEqual({});
  });

  it("approximates the configured chance over many cycles", () => {
    const total = rollIdleCycleLoot({
      runSeed: 123,
      firstCycleIndex: 0,
      cycles: 20_000,
      kills: [{ dungeonId: "d1", rank: "boss" }],
      rules,
    });
    const sealRate = (total.seal ?? 0) / 20_000;
    expect(sealRate).toBeGreaterThan(0.085);
    expect(sealRate).toBeLessThan(0.115);
  });

  it("gives each idle cycle its own seed and splits cleanly across claims", () => {
    expect(deriveCycleLootSeed(5, 0)).not.toBe(deriveCycleLootSeed(5, 1));
    expect(deriveCycleLootSeed(5, 0)).not.toBe(deriveCycleLootSeed(6, 0));
    const kills = [{ dungeonId: "d1", rank: "boss" as const }];
    const whole = rollIdleCycleLoot({ runSeed: 9, firstCycleIndex: 0, cycles: 50, kills, rules });
    const first = rollIdleCycleLoot({ runSeed: 9, firstCycleIndex: 0, cycles: 20, kills, rules });
    const second = rollIdleCycleLoot({ runSeed: 9, firstCycleIndex: 20, cycles: 30, kills, rules });
    expect(mergeMaterialCounts(first, second)).toEqual(whole);
  });

  it("rejects invalid quantities when merging", () => {
    expect(() => mergeMaterialCounts({ bark: -1 })).toThrow(/non-negative/);
    expect(mergeMaterialCounts({ bark: 0 }, { bark: 2 })).toEqual({ bark: 2 });
  });
});
