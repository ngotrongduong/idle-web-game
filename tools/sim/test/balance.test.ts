import { describe, expect, it } from "vitest";
import { simulateWave } from "@idle/game-core";
import { currentBattleRules, foundationGameData } from "@idle/game-data";
import { buildTeam, buildWaveEnemies, tierAndLevelForCombatLevel } from "../src/scenarios";

// Win-rate bands for the content curve, using the server's own stat and battle formulas.
const RUNS = 120;
const t1 = foundationGameData.classes.filter((entry) => entry.tier === 1).map((entry) => entry.id);
const trios: string[][] = [];
for (let i = 0; i < t1.length; i += 1)
  for (let j = i + 1; j < t1.length; j += 1)
    for (let k = j + 1; k < t1.length; k += 1) trios.push([t1[i]!, t1[j]!, t1[k]!]);

function trio(classIds: string[], level: number) {
  return buildTeam(classIds.map((classId) => ({ classId, level })));
}

function familyTeam(combatLevel: number) {
  const { tier, level } = tierAndLevelForCombatLevel(combatLevel);
  return buildTeam(
    foundationGameData.classFamilies.map((family) => ({
      classId: foundationGameData.classes.find(
        (entry) => entry.familyId === family.id && entry.tier === tier,
      )!.id,
      level,
    })),
  );
}

function winRates(dungeonId: string, team: ReturnType<typeof buildTeam>) {
  const dungeon = foundationGameData.dungeons.find((entry) => entry.id === dungeonId)!;
  return Array.from({ length: dungeon.waveCount }, (_, index) => {
    const { enemies } = buildWaveEnemies(dungeonId, index + 1);
    let wins = 0;
    let draws = 0;
    for (let run = 0; run < RUNS; run += 1) {
      const result = simulateWave({
        allies: team,
        enemies,
        seed: (Math.imul(run, 40503) + index * 7) >>> 0,
        rules: currentBattleRules,
      });
      if (result.result === "win") wins += 1;
      if (result.result === "draw") draws += 1;
    }
    expect(draws / RUNS).toBeLessThan(0.02);
    return wins / RUNS;
  });
}

describe("content difficulty bands", () => {
  it("lets fresh Lv1 recruits farm Thornwood but not beat its boss reliably", () => {
    for (const classIds of trios) {
      const rates = winRates("bamboo_grove", trio(classIds, 1));
      expect(rates[0]).toBeGreaterThanOrEqual(0.7);
      expect(rates.at(-1)).toBeLessThanOrEqual(0.5);
      expect(winRates("bamboo_grove", trio(classIds, 10)).at(-1)).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("gates Mistmoor behind the T1 level cap", () => {
    for (const classIds of trios) {
      expect(winRates("misty_riverbank", trio(classIds, 1)).at(-1)).toBeLessThanOrEqual(0.1);
      const capped = winRates("misty_riverbank", trio(classIds, 10)).at(-1)!;
      expect(capped).toBeGreaterThanOrEqual(0.4);
      expect(capped).toBeLessThanOrEqual(0.9);
    }
  });

  it("needs mid T2 for the Sunken Abbey and mid T3 for the Dragonfire Crags", () => {
    expect(winRates("sunken_shrine", familyTeam(10)).at(-1)).toBeLessThanOrEqual(0.15);
    expect(winRates("sunken_shrine", familyTeam(20)).at(-1)).toBeGreaterThanOrEqual(0.85);
    expect(winRates("ember_ridge", familyTeam(20)).at(-1)).toBeLessThanOrEqual(0.15);
    expect(winRates("ember_ridge", familyTeam(30)).at(-1)).toBeGreaterThanOrEqual(0.9);
  });
});
