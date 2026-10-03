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
    expect(data.skills).toHaveLength(24);
    expect(data.dungeons).toHaveLength(4);
    expect(data.enemies).toHaveLength(12);
    expect(data.bosses).toHaveLength(4);
    expect(data.waves).toHaveLength(24);
    expect(data.items.length).toBeGreaterThanOrEqual(30);
    expect(data.materials.length).toBeGreaterThanOrEqual(15);
  });

  it("gives every class exactly one skill row", () => {
    expect(
      new Set(foundationGameData.skills.map((entry) => entry.classId)),
    ).toEqual(
      new Set(foundationGameData.classes.map((entry) => entry.id)),
    );
  });

  it("puts exactly one boss on the final wave of each dungeon", () => {
    for (const dungeon of foundationGameData.dungeons) {
      const waves = foundationGameData.waves
        .filter((entry) => entry.dungeonId === dungeon.id)
        .sort((left, right) => left.waveIndex - right.waveIndex);
      expect(waves).toHaveLength(dungeon.waveCount);
      expect(waves.at(-1)?.bossId).toBeTruthy();
      expect(waves.slice(0, -1).every((entry) => entry.bossId === null)).toBe(
        true,
      );
    }
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

  it("rejects a wave that pulls an enemy from another dungeon", () => {
    const firstWave = foundationGameData.waves[0]!;
    const foreignEnemy = foundationGameData.enemies.find(
      (entry) => entry.dungeonId !== firstWave.dungeonId,
    )!;

    const invalid = {
      ...foundationGameData,
      waves: foundationGameData.waves.map((entry, index) =>
        index === 0 ? { ...entry, enemyIds: [foreignEnemy.id] } : entry,
      ),
    };

    expect(() => validateGameData(invalid)).toThrow(
      "from another dungeon",
    );
  });

  it("rejects broken CSV references before generation", () => {
    expect(() =>
      loadGameDataFromCsv({
        materials: "id,name_vi,name_en\na,A,A",
        items:
          "id,name_vi,name_en,slot,attack,defense,recipe\ni,I,I,weapon,1,0,missing:1",
        dungeons:
          "id,name_vi,name_en,recommended_level,wave_count,loot_material_ids\nd,D,D,1,1,a",
        classes:
          "id,family,tier,parent_class_id,role,name_vi,name_en,base_hp,base_attack,base_defense,base_speed\nc,vanguard,1,,tank,C,C,10,2,2,1",
        enemies:
          "id,name_vi,name_en,dungeon_id,hp,attack,defense,speed\ne,E,E,d,10,2,2,1",
        skills:
          "class_id,ult_id,name_vi,name_en,effect,target,power_bps,passive_stat,passive_bonus_bps\nc,u,U,U,damage_single,lowest_hp_enemy,10000,attack,100",
        bosses:
          "id,name_vi,name_en,dungeon_id,hp,attack,defense,speed\nb,B,B,d,20,3,3,1",
        waves:
          "dungeon_id,wave_index,enemy_ids,boss_id\nd,1,,b",
      }),
    ).toThrow("references missing material missing");
  });
});
