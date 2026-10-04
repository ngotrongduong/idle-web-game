import { describe, expect, it } from "vitest";
import { findCatalogName, localizedName } from "./catalog-names";
import { createTranslator, joinParts } from "./translator";

const wardSquire = { id: "ward_squire", nameVi: "Tân Vệ", nameEn: "Ward Squire" };

describe("catalog names", () => {
  it("picks the name in the player's language", () => {
    expect(localizedName(wardSquire, "vi")).toBe("Tân Vệ");
    expect(localizedName(wardSquire, "en")).toBe("Ward Squire");
  });

  it("looks a name up by id and says so when it is missing", () => {
    const entries = [wardSquire, { id: "iron_guard", nameVi: "Thiết Giáp", nameEn: "Iron Guard" }];
    expect(findCatalogName(entries, "iron_guard", "en")).toBe("Iron Guard");
    expect(findCatalogName(entries, "iron_guard", "vi")).toBe("Thiết Giáp");
    // The caller shows a placeholder: the legacy id must not reach the screen.
    expect(findCatalogName(entries, "no_such_class", "en")).toBeUndefined();
    expect(findCatalogName(undefined, "iron_guard", "en")).toBeUndefined();
  });
});

describe("translator", () => {
  it("is bound to one locale", () => {
    const vi = createTranslator("vi");
    const en = createTranslator("en");
    expect(vi.locale).toBe("vi");
    expect(vi.t("nav.dungeon")).toBe("Đội & Hầm");
    expect(en.t("nav.dungeon")).toBe("Teams & Dungeons");
    expect(vi.name(wardSquire)).toBe("Tân Vệ");
    expect(en.name(wardSquire)).toBe("Ward Squire");
  });

  it("formats values, plurals, numbers and times for its locale", () => {
    const vi = createTranslator("vi");
    const en = createTranslator("en");
    expect(vi.format("dungeon.teamTitle", { slot: 2 })).toBe("Đội 2");
    expect(en.format("dungeon.teamTitle", { slot: 2 })).toBe("Team 2");
    expect(en.plural("dungeon.cycles", 1)).toBe("1 cycle");
    expect(en.plural("dungeon.cycles", 168)).toBe("168 cycles");
    expect(vi.plural("dungeon.cycles", 168)).toBe("168 cycle");
    expect(vi.number(626_480)).toBe("626.480");
    expect(en.number(626_480)).toBe("626,480");
    const evening = new Date(2026, 9, 5, 21, 30);
    expect(vi.time(evening)).toBe("21:30");
    expect(en.time(evening).replace(/\s/g, " ")).toBe("09:30 PM");
  });

  it("builds a line from parts with the same separator in every language", () => {
    expect(joinParts(["a", "b", "c"])).toBe("a · b · c");
    expect(joinParts([])).toBe("");
    expect(createTranslator("en").list(["x", "y"])).toBe("x · y");
  });

  it("reads the same sentence in both languages from the same values", () => {
    const values = { building: "X", gold: 300, time: "1:00" };
    expect(createTranslator("vi").format("buildings.upgradeAction", values)).toBe(
      "Nâng cấp X (300 vàng · 1:00)",
    );
    expect(createTranslator("en").format("buildings.upgradeAction", values)).toBe(
      "Upgrade X (300 gold · 1:00)",
    );
  });
});
