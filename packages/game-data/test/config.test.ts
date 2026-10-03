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

  it("loads and validates committed generated data", () => {
    expect(foundationGameData.version).toBe("m0.3");
    expect(foundationGameData.materials.length).toBe(3);
    expect(foundationGameData.dungeons[0]?.waveCount).toBe(6);
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
