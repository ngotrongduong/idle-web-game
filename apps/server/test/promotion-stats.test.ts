import { describe, expect, it } from "vitest";
import { calculateHeroStats, levelCapForTier, retainHeroPotential } from "@idle/game-core";
import { foundationGameData, promotionConfig } from "@idle/game-data";

// docs/03 §2 power formula (no MATK/MDEF/crit stats yet).
const power = (stats: { hp: number; attack: number; defense: number; speed: number }) =>
  stats.hp * 0.5 + stats.attack * 2 + stats.defense * 1.5 + stats.speed * 4;

describe("promotion keeps heroes at least as strong (GDD §5.3)", () => {
  for (const child of foundationGameData.classes.filter((entry) => entry.parentClassId)) {
    const parent = foundationGameData.classes.find((entry) => entry.id === child.parentClassId)!;

    it(`${parent.id} cap -> ${child.id} Lv1`, () => {
      const atCap = calculateHeroStats({
        ...parent,
        level: levelCapForTier(parent.tier),
        rarity: "common",
      });
      const promoted = calculateHeroStats({
        ...child,
        level: 1,
        rarity: "common",
        potential: retainHeroPotential(atCap, promotionConfig.retainedPotentialBps),
      });

      expect(power(promoted)).toBeGreaterThanOrEqual(power(atCap));
      for (const stat of ["hp", "attack", "defense", "speed"] as const) {
        expect(promoted[stat]).toBeGreaterThanOrEqual(Math.floor(atCap[stat] * 0.8));
      }
    });
  }
});
