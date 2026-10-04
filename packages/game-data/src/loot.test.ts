import { describe, expect, it } from "vitest";
import {
  buildingsConfig,
  foundationGameData,
  lootConfig,
  promotionConfig,
  validateLootConfig,
} from "./index";

describe("loot config", () => {
  it("covers every dungeon rank with loot from that dungeon's material list", () => {
    // Boss-only extras that are not crafting materials of the dungeon.
    const isSpecialDrop = (materialId: string) =>
      materialId.startsWith("promotion_seal_") || materialId === buildingsConfig.speedUp.materialId;

    for (const dungeon of foundationGameData.dungeons) {
      for (const rank of ["normal", "elite", "boss"] as const) {
        const rules = lootConfig.rules.filter(
          (rule) => rule.dungeonId === dungeon.id && rule.rank === rank,
        );
        expect(rules.length).toBeGreaterThan(0);
      }
      const regular = lootConfig.rules.filter(
        (rule) => rule.dungeonId === dungeon.id && !isSpecialDrop(rule.materialId),
      );
      expect(regular.every((rule) => dungeon.lootMaterialIds.includes(rule.materialId))).toBe(true);
    }
  });

  it("drops the build speed-up item from every dungeon boss and nowhere else", () => {
    const sources = lootConfig.rules.filter(
      (rule) => rule.materialId === buildingsConfig.speedUp.materialId,
    );
    expect(sources.map((rule) => rule.dungeonId).sort()).toEqual(
      foundationGameData.dungeons.map((dungeon) => dungeon.id).sort(),
    );
    expect(sources.every((rule) => rule.rank === "boss")).toBe(true);
  });

  it("drops every promotion seal from a boss so promotion is reachable", () => {
    for (const rule of promotionConfig.rules) {
      const sources = lootConfig.rules.filter(
        (entry) => entry.materialId === rule.sealMaterialId && entry.rank === "boss",
      );
      expect(sources.length).toBeGreaterThan(0);
    }
  });

  it("rejects references to missing materials or dungeons", () => {
    const base = {
      dungeonId: "bamboo_grove",
      rank: "normal",
      chanceBps: 100,
      minQty: 1,
      maxQty: 1,
    };
    expect(() =>
      validateLootConfig(
        { rules: [...lootConfig.rules, { ...base, materialId: "missing_material" }] },
        foundationGameData,
        promotionConfig,
      ),
    ).toThrow(/missing material/);
    expect(() =>
      validateLootConfig(
        {
          rules: [...lootConfig.rules, { ...base, dungeonId: "missing", materialId: "slime_gel" }],
        },
        foundationGameData,
        promotionConfig,
      ),
    ).toThrow(/missing dungeon/);
  });

  it("rejects a loot table where a promotion seal cannot be earned", () => {
    const withoutSeals = lootConfig.rules.filter(
      (rule) => !rule.materialId.startsWith("promotion_seal_"),
    );
    expect(() =>
      validateLootConfig({ rules: withoutSeals }, foundationGameData, promotionConfig),
    ).toThrow(/no boss loot source/);
  });

  it("rejects duplicate rules and inverted quantity ranges", () => {
    expect(() =>
      validateLootConfig(
        { rules: [...lootConfig.rules, lootConfig.rules[0]] },
        foundationGameData,
        promotionConfig,
      ),
    ).toThrow(/Duplicate loot rule/);
    expect(() =>
      validateLootConfig(
        { rules: [{ ...lootConfig.rules[0], minQty: 3, maxQty: 1 }] },
        foundationGameData,
        promotionConfig,
      ),
    ).toThrow(/minQty/);
  });
});
