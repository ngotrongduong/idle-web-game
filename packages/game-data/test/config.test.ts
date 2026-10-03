import { describe, expect, it } from "vitest";
import {
  foundationGameData,
  loadGameDataFromCsv,
  parseCsv,
  validateGameData,
  validateMvpContentSlice,
} from "../src/index";

describe("game-data pipeline", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsv('id,name\nx,"A, B"')).toEqual([
      { id: "x", name: "A, B" },
    ]);
  });

  it("validates the committed MVP content slice", () => {
    const data = validateMvpContentSlice(foundationGameData);
    expect(data.version).toBe("m0.3-mvp-slice");
    expect(data.classes).toHaveLength(24);
    expect(data.dungeons).toHaveLength(4);
    expect(data.enemies).toHaveLength(12);
    expect(data.items.length).toBeGreaterThanOrEqual(30);
    expect(data.materials.length).toBeGreaterThanOrEqual(15);
  });

  it("rejects a missing recipe material reference", () => {
    const invalid = {
      ...foundationGameData,
      items: [
        {
          ...foundationGameData.items[0]!,
          recipe: [{ materialId: "missing_material", qty: 1 }],
        },
        ...foundationGameData.items.slice(1),
      ],
    };

    expect(() => validateGameData(invalid)).toThrow(
      "references missing material missing_material",
    );
  });

  it("rejects a class parent from the wrong family", () => {
    const tierTwo = foundationGameData.classes.find(
      (entry) => entry.family === "ranger" && entry.tier === 2,
    )!;
    const wrongParent = foundationGameData.classes.find(
      (entry) => entry.family === "vanguard" && entry.tier === 1,
    )!;

    const invalid = {
      ...foundationGameData,
      classes: foundationGameData.classes.map((entry) =>
        entry.id === tierTwo.id
          ? { ...entry, parentClassId: wrongParent.id }
          : entry,
      ),
    };

    expect(() => validateGameData(invalid)).toThrow(
      "parent must stay in family ranger",
    );
  });

  it("rejects an enemy assigned to a missing dungeon", () => {
    const invalid = {
      ...foundationGameData,
      enemies: [
        {
          ...foundationGameData.enemies[0]!,
          dungeonId: "missing_dungeon",
        },
        ...foundationGameData.enemies.slice(1),
      ],
    };

    expect(() => validateGameData(invalid)).toThrow(
      "references missing dungeon missing_dungeon",
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
        classes:
          "id,family,tier,parent_class_id,role,name_vi,name_en,base_hp,base_attack,base_defense,base_speed\nc,vanguard,1,,tank,C,C,10,2,2,1",
        enemies:
          "id,name_vi,name_en,dungeon_id,hp,attack,defense,speed\ne,E,E,d,10,2,2,1",
      }),
    ).toThrow("references missing material missing");
  });
});
