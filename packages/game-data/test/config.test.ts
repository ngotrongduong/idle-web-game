import { describe, expect, it } from "vitest";
import { foundationGameData, loadGameDataFromCsv, parseCsv, validateGameData } from "../src/index";

describe("game-data pipeline", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsv('id,name\nx,"A, B"')).toEqual([{ id: "x", name: "A, B" }]);
  });

  it("loads the complete first MVP content slice", () => {
    expect(foundationGameData.version).toBe("m0.3-content-v3");
    expect(foundationGameData.materials).toHaveLength(17);
    expect(foundationGameData.items).toHaveLength(30);
    expect(foundationGameData.dungeons).toHaveLength(4);
    expect(foundationGameData.classFamilies).toHaveLength(4);
    expect(foundationGameData.classes).toHaveLength(24);
    expect(foundationGameData.enemies).toHaveLength(16);
  });

  it("matches the planned 1/2/3 class progression per family", () => {
    for (const family of foundationGameData.classFamilies) {
      const familyClasses = foundationGameData.classes.filter(
        (entry) => entry.familyId === family.id,
      );
      expect(familyClasses.filter((entry) => entry.tier === 1)).toHaveLength(1);
      expect(familyClasses.filter((entry) => entry.tier === 2)).toHaveLength(2);
      expect(familyClasses.filter((entry) => entry.tier === 3)).toHaveLength(3);
    }
  });

  it("defines explicit deterministic ultimate behavior for every class", () => {
    expect(
      foundationGameData.classes.every(
        (entry) => entry.ultimatePowerBps > 0 && ["damage", "heal"].includes(entry.ultimateKind),
      ),
    ).toBe(true);

    const supports = foundationGameData.classes.filter((entry) => entry.role === "support");
    expect(supports.length).toBeGreaterThan(0);
    expect(supports.every((entry) => entry.ultimateKind === "heal")).toBe(true);
  });

  it("gives every dungeon normal enemies, an elite and exactly one boss", () => {
    for (const dungeon of foundationGameData.dungeons) {
      const dungeonEnemies = foundationGameData.enemies.filter(
        (entry) => entry.dungeonId === dungeon.id,
      );
      expect(
        dungeonEnemies.filter((entry) => entry.rank === "normal").length,
      ).toBeGreaterThanOrEqual(2);
      expect(dungeonEnemies.filter((entry) => entry.rank === "elite")).toHaveLength(1);
      expect(dungeonEnemies.filter((entry) => entry.rank === "boss")).toHaveLength(1);
    }
  });

  it("contains promotion seals referenced by the promotion tuning config", () => {
    const materialIds = new Set(foundationGameData.materials.map((entry) => entry.id));
    expect(materialIds.has("promotion_seal_t1")).toBe(true);
    expect(materialIds.has("promotion_seal_t2")).toBe(true);
  });

  it("covers all four equipment slots", () => {
    const slots = new Set(foundationGameData.items.map((entry) => entry.slot));
    expect(slots).toEqual(new Set(["weapon", "helmet", "armor", "accessory"]));
  });

  it("rejects a missing class parent", () => {
    const tierTwo = foundationGameData.classes.find((entry) => entry.tier === 2)!;
    const invalid = {
      ...foundationGameData,
      classes: foundationGameData.classes.map((entry) =>
        entry.id === tierTwo.id ? { ...entry, parentClassId: "missing_parent" } : entry,
      ),
    };
    expect(() => validateGameData(invalid)).toThrow("references missing parent missing_parent");
  });

  it("rejects an enemy assigned to an unknown dungeon", () => {
    const invalid = {
      ...foundationGameData,
      enemies: [
        { ...foundationGameData.enemies[0]!, dungeonId: "missing_dungeon" },
        ...foundationGameData.enemies.slice(1),
      ],
    };
    expect(() => validateGameData(invalid)).toThrow("references missing dungeon missing_dungeon");
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

    expect(() => validateGameData(invalid)).toThrow("references missing material missing_material");
  });

  it("rejects broken CSV references before generation", () => {
    expect(() =>
      loadGameDataFromCsv({
        materials: "id,name_vi,name_en\na,A,A",
        items: "id,name_vi,name_en,slot,attack,defense,recipe\ni,I,I,weapon,1,0,a:1",
        dungeons: "id,name_vi,name_en,recommended_level,wave_count,loot_material_ids\nd,D,D,1,6,a",
        classFamilies:
          "id,name_vi,name_en,archetype,damage_type,advantage_family_id\nf,F,F,frontline,physical,missing",
        classes:
          "id,name_vi,name_en,family_id,tier,parent_class_id,role,base_hp,base_attack,base_defense,base_speed,targeting,ultimate_kind,ultimate_targeting,ultimate_power_bps\nc,C,C,f,1,,tank,10,2,1,1,random,damage,highest_attack,13000",
        enemies:
          "id,name_vi,name_en,dungeon_id,rank,hp,attack,defense,speed,reward_gold,reward_exp\ne,E,E,d,boss,10,2,1,1,1,1",
      }),
    ).toThrow("references missing advantage family missing");
  });
});
