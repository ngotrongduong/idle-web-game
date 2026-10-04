import { describe, expect, it } from "vitest";
import {
  applyBuildingState,
  clockOffsetMs,
  constructionProgress,
  dismantleDustFor,
  enhanceBlock,
  enhanceCapLabel,
  forgeLevelForEnhance,
  formatBps,
  formatDuration,
  oddsLabel,
  remainingBuildMs,
  speedUpItemsNeeded,
  upgradeBlock,
  type Construction,
  type ForgeLevel,
  type QualityTier,
} from "./buildings";

const START = Date.parse("2026-10-05T00:00:00.000Z");

const construction: Construction = {
  building: "hall",
  targetLevel: 2,
  startedAt: new Date(START).toISOString(),
  completesAt: new Date(START + 60_000).toISOString(),
};

const tiers: QualityTier[] = [
  {
    id: "common",
    nameVi: "Thường",
    nameEn: "Common",
    weightBps: 7_000,
    multiplierBps: 10_000,
    dismantleDust: 1,
  },
  {
    id: "fine",
    nameVi: "Tinh xảo",
    nameEn: "Fine",
    weightBps: 2_500,
    multiplierBps: 11_000,
    dismantleDust: 2,
  },
  {
    id: "rare",
    nameVi: "Hiếm",
    nameEn: "Rare",
    weightBps: 450,
    multiplierBps: 12_000,
    dismantleDust: 3,
  },
  {
    id: "masterwork",
    nameVi: "Kiệt tác",
    nameEn: "Masterwork",
    weightBps: 50,
    multiplierBps: 13_000,
    dismantleDust: 5,
  },
];

const forge: ForgeLevel[] = [0, 2, 3, 4, 5, 5].map((maxEnhanceLevel, index) => ({
  level: index + 1,
  maxEnhanceLevel,
  qualityWeightsBps: [7_000 - index * 300, 2_500 + index * 200, 450 + index * 80, 50 + index * 20],
  upgradeGoldCost: 240,
  buildSeconds: 48,
  upgradeMaterials: [],
}));

describe("build countdown", () => {
  it("formats minutes and hours and rounds a partial second up", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(48)).toBe("0:48");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(59.2)).toBe("1:00");
    expect(formatDuration(782)).toBe("13:02");
    expect(formatDuration(3_600)).toBe("1:00:00");
    expect(formatDuration(10_190)).toBe("2:49:50");
  });

  it("never shows a negative or broken duration", () => {
    expect(formatDuration(-5)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
  });

  it("counts down on the server clock even when the device clock is wrong", () => {
    // The device is ten minutes ahead of the server.
    const deviceNow = START + 600_000 + 15_000;
    const offset = clockOffsetMs(new Date(START + 15_000).toISOString(), deviceNow);
    expect(offset).toBe(-600_000);
    expect(remainingBuildMs(construction, deviceNow + offset)).toBe(45_000);
    expect(constructionProgress(construction, deviceNow + offset)).toBeCloseTo(0.25);
  });

  it("clamps the remaining time and the progress once the build is over", () => {
    expect(remainingBuildMs(construction, START + 61_000)).toBe(0);
    expect(constructionProgress(construction, START + 61_000)).toBe(1);
    expect(constructionProgress(construction, START - 1_000)).toBe(0);
    expect(clockOffsetMs("not a date", START)).toBe(0);
  });

  it("asks for only as many speed-up items as the remaining time needs", () => {
    expect(speedUpItemsNeeded(60_000, 300)).toBe(1);
    expect(speedUpItemsNeeded(300_000, 300)).toBe(1);
    expect(speedUpItemsNeeded(300_001, 300)).toBe(2);
    expect(speedUpItemsNeeded(782_000, 300)).toBe(3);
    expect(speedUpItemsNeeded(0, 300)).toBe(0);
  });
});

describe("upgrade and enhancement gating", () => {
  const owned = (materialId: string) => (materialId === "river_stone" ? 2 : 0);

  it("explains why an upgrade cannot start, in the order the server checks", () => {
    const base = {
      goldCost: 240,
      materials: [{ materialId: "river_stone", qty: 3 }],
      gold: 100,
      owned,
      builderBusy: true,
    };
    expect(upgradeBlock({ ...base, goldCost: null })).toBe("max_level");
    expect(upgradeBlock(base)).toBe("builder_busy");
    expect(upgradeBlock({ ...base, builderBusy: false })).toBe("gold");
    expect(upgradeBlock({ ...base, builderBusy: false, gold: 240 })).toBe("materials");
    expect(upgradeBlock({ ...base, builderBusy: false, gold: 240, owned: () => 3 })).toBeNull();
  });

  it("finds the Forge level an enhancement needs", () => {
    expect(forgeLevelForEnhance(forge, 0)).toBe(2);
    expect(forgeLevelForEnhance(forge, 1)).toBe(2);
    expect(forgeLevelForEnhance(forge, 2)).toBe(3);
    expect(forgeLevelForEnhance(forge, 4)).toBe(5);
    expect(forgeLevelForEnhance(forge, 5)).toBeNull();
  });

  it("locks Enhance behind the Forge cap before it looks at gold and dust", () => {
    const base = {
      enhanceLevel: 0,
      maxEnhanceLevel: 5,
      forgeCap: 0,
      goldCost: 100,
      dustCost: 1,
      gold: 0,
      dust: 0,
    };
    expect(enhanceBlock(base)).toBe("forge");
    expect(enhanceBlock({ ...base, forgeCap: 2 })).toBe("gold");
    expect(enhanceBlock({ ...base, forgeCap: 2, gold: 100 })).toBe("dust");
    expect(enhanceBlock({ ...base, forgeCap: 2, gold: 100, dust: 1 })).toBeNull();
    expect(enhanceBlock({ ...base, forgeCap: 2, enhanceLevel: 2, gold: 999, dust: 99 })).toBe(
      "forge",
    );
    expect(enhanceBlock({ ...base, enhanceLevel: 5, goldCost: undefined })).toBe("max_level");
  });

  it("shows the dust of the best quality tier an item reaches", () => {
    expect(dismantleDustFor(10_000, tiers)).toBe(1);
    expect(dismantleDustFor(11_000, tiers)).toBe(2);
    expect(dismantleDustFor(12_500, tiers)).toBe(3);
    expect(dismantleDustFor(13_000, tiers)).toBe(5);
    expect(dismantleDustFor(13_000, [])).toBe(0);
  });

  it("lists craft odds for a Forge level in the player's language", () => {
    expect(oddsLabel(tiers, forge[1]!.qualityWeightsBps, "vi")).toBe(
      "Thường 67% · Tinh xảo 27% · Hiếm 5,3% · Kiệt tác 0,7%",
    );
    expect(oddsLabel(tiers, undefined, "vi")).toBe(
      "Thường 70% · Tinh xảo 25% · Hiếm 4,5% · Kiệt tác 0,5%",
    );
    expect(oddsLabel(tiers, forge[1]!.qualityWeightsBps, "en")).toBe(
      "Common 67% · Fine 27% · Rare 5.3% · Masterwork 0.7%",
    );
    expect(oddsLabel(tiers, undefined, "en")).toBe(
      "Common 70% · Fine 25% · Rare 4.5% · Masterwork 0.5%",
    );
  });

  it("labels the enhancement cap in both languages", () => {
    expect(enhanceCapLabel(0, "vi")).toBe("chưa mở");
    expect(enhanceCapLabel(0, "en")).toBe("locked");
    expect(enhanceCapLabel(2, "vi")).toBe("+2");
    expect(enhanceCapLabel(2, "en")).toBe("+2");
  });

  it("formats basis points with the locale's decimal separator", () => {
    expect(formatBps(7_000, "vi")).toBe("70%");
    expect(formatBps(7_000, "en")).toBe("70%");
    expect(formatBps(450, "vi")).toBe("4,5%");
    expect(formatBps(450, "en")).toBe("4.5%");
    expect(formatBps(50, "en")).toBe("0.5%");
    expect(formatBps(4_375, "vi")).toBe("43,75%");
    expect(formatBps(4_375, "en")).toBe("43.75%");
  });
});

describe("merging building levels into the player state", () => {
  const player = { id: "p", version: 3, gold: 700, hallLevel: 1, forgeLevel: 1, construction };

  it("keeps the same object when the server reports nothing new", () => {
    expect(
      applyBuildingState(player, {
        hallLevel: 1,
        forgeLevel: 1,
        construction: { ...construction },
      }),
    ).toBe(player);
  });

  it("applies a finished build without touching the version or the gold", () => {
    expect(applyBuildingState(player, { hallLevel: 2, forgeLevel: 1, construction: null })).toEqual(
      { id: "p", version: 3, gold: 700, hallLevel: 2, forgeLevel: 1, construction: null },
    );
  });

  it("picks up a sped-up completion time", () => {
    const spedUp = { ...construction, completesAt: new Date(START + 10_000).toISOString() };
    expect(
      applyBuildingState(player, { hallLevel: 1, forgeLevel: 1, construction: spedUp })
        .construction,
    ).toEqual(spedUp);
  });
});
