import { describe, expect, it } from "vitest";
import {
  foundationGameData,
  loadGameDataFromCsv,
  parseCsv,
  validateGameData,
} from "../src/index";

describe("game-data pipeline", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsv('id,name\nx,"A, B"')).toEqual([
      { id: "x", name: "A, B" },
    ]);
  });

  it("loads and validates committed MVP content slice", () => {
    expect(foundationGameData.version).toBe("m0.3-content-v1");
    expect(foundationGameData.materials).toHaveLength(15);
    expect(foundationGameData.items).toHaveLength(30);
    expect(foundationGameData.dungeons).toHaveLength(4);
    expect(foundationGameData.dungeons.every((entry) => entry.waveCount === 6)).toBe(true);
  });

  it("covers all four equipment slots", () => {
    const slots = new Set(foundationGameData.items.map((entry) => entry.slot));
    expect(slots).toEqual(new Set(["weapon", "helmet", "armor", "accessory"]));
  });

  it("gives every dungeon at least three material drops", () => {
    expect(
      foundationGameData.dungeons.every((entry) => entry.lootMaterialIds.length >= 3),
    ).toBe(true);
  });

  it("rejects a missing recipe material reference", () => {
    const invalid = {
      ...foundationGameData,
      items: [
        {
          ...foundationGameData.items[0]!,
          recipe: [{ materialId: "missing_material", qty: 1 }],
        },
      ],
    };

    expect(() => validateGameData(invalid)).toThrow(
      "references missing material missing_material",
    );
  });

  it("rejects broken CSV references before generation", () => {
    expect(() =>
      loadGameDataFromCsv({
        materials: "id,name_vi,name_en\na,A,A",
        items:
          "id,name_vi,name_en,slot,attack,defense,recipe\ni,I,I,weapon,1,0,missing:1",
        dungeons:
          "id,name_vi,name_en,recommended_level,wave_count,loot_material_ids\nd,D,D,1,6,a",
      }),
    ).toThrow("references missing material missing");
  });
});
