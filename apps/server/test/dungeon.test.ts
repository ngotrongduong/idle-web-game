import { describe, expect, it } from "vitest";
import type { DungeonRun, Hero } from "@idle/api-contract";
import { foundationGameData } from "@idle/game-data";
import {
  CURRENT_DUNGEON_BATTLE_RULES,
  deriveRunSeed,
  deriveWaveSeed,
  heroToCombatant,
  sampleDungeonCycles,
  simulateDungeonCycle,
} from "../src/dungeon.js";
import { cycleRewards, runCycleSamples } from "../src/idle.js";

const heroes: Hero[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    classId: "ward_squire",
    rarity: "common",
    level: 10,
    exp: 0,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    classId: "trail_archer",
    rarity: "elite",
    level: 10,
    exp: 0,
  },
];

const weakHero: Hero[] = [{ ...heroes[0]!, level: 1 }];
const freshRecruits: Hero[] = (["ward_squire", "trail_archer", "dawn_acolyte"] as const).map(
  (classId, index) => ({
    id: `00000000-0000-4000-8000-00000000001${index}`,
    classId,
    rarity: "common",
    level: 1,
    exp: 0,
  }),
);

describe("dungeon replay generation", () => {
  it("replays the same six waves identically for the same seed", () => {
    const left = simulateDungeonCycle({ heroes, dungeonId: "bamboo_grove", seed: 123_456 });
    const right = simulateDungeonCycle({ heroes, dungeonId: "bamboo_grove", seed: 123_456 });

    expect(left).toEqual(right);
    expect(left).toHaveLength(6);
    expect(left.map((wave) => wave.seed)).toEqual(
      Array.from({ length: 6 }, (_, index) => deriveWaveSeed(123_456, index + 1)),
    );
  });

  it("snapshots the configured boss in the final wave", () => {
    const waves = simulateDungeonCycle({ heroes, dungeonId: "bamboo_grove", seed: 42 });
    const boss = foundationGameData.enemies.find(
      (enemy) => enemy.dungeonId === "bamboo_grove" && enemy.rank === "boss",
    );

    expect(boss).toBeDefined();
    expect(waves[5]?.enemies.map((enemy) => enemy.id)).toEqual([boss!.id]);
    expect(waves.every((wave) => /^[0-9a-f]{8}$/.test(wave.hash))).toBe(true);
  });

  it("stops a cycle at the first lost wave", () => {
    const waves = simulateDungeonCycle({ heroes: weakHero, dungeonId: "misty_riverbank", seed: 7 });

    expect(waves.at(-1)?.result).not.toBe("win");
    expect(waves.slice(0, -1).every((wave) => wave.result === "win")).toBe(true);
    expect(waves.length).toBeLessThan(6);
  });

  it("applies rarity to the persisted hero combat snapshot", () => {
    const common = heroToCombatant(heroes[0]!);
    const rare = heroToCombatant({ ...heroes[0]!, rarity: "rare" });

    expect(rare.hp).toBeGreaterThan(common.hp);
    expect(rare.attack).toBeGreaterThan(common.attack);
    expect(rare.defense).toBeGreaterThan(common.defense);
  });
});

describe("sampled idle rewards (docs/04 §6)", () => {
  const seedFor = (team: Hero[]) =>
    deriveRunSeed({
      playerId: "player-1",
      dungeonId: "bamboo_grove",
      allies: team.map((hero) => heroToCombatant(hero)),
      rules: CURRENT_DUNGEON_BATTLE_RULES,
    });

  it("keeps the run seed stable for the same team so restarts cannot reroll", () => {
    expect(seedFor(heroes)).toBe(seedFor([...heroes].reverse()));
    expect(seedFor(heroes)).not.toBe(seedFor([{ ...heroes[0]!, level: 9 }, heroes[1]!]));
  });

  it("persists sample 0 as the replay and keeps every sample reproducible", () => {
    const seed = seedFor(freshRecruits);
    const first = sampleDungeonCycles({
      heroes: freshRecruits,
      dungeonId: "bamboo_grove",
      seed,
      samples: 30,
    });
    const second = sampleDungeonCycles({
      heroes: freshRecruits,
      dungeonId: "bamboo_grove",
      seed,
      samples: 30,
    });

    expect(first).toEqual(second);
    expect(first.cycleSamples).toHaveLength(30);
    expect(first.waves).toEqual(
      simulateDungeonCycle({ heroes: freshRecruits, dungeonId: "bamboo_grove", seed }),
    );
    expect(new Set(first.cycleSamples.map((sample) => sample.kills.boss)).size).toBeGreaterThan(1);
  });

  it("pays cycle c from sample c % N, so split claims sum to the same total", () => {
    const seed = seedFor(freshRecruits);
    const { waves, cycleSamples } = sampleDungeonCycles({
      heroes: freshRecruits,
      dungeonId: "bamboo_grove",
      seed,
      samples: 30,
    });
    const run = { dungeonId: "bamboo_grove", seed, waves, cycleSamples };

    const whole = cycleRewards(run, 0, 75);
    const first = cycleRewards(run, 0, 31);
    const rest = cycleRewards(run, 31, 44);
    expect(first.gold + rest.gold).toBe(whole.gold);
    expect(first.exp + rest.exp).toBe(whole.exp);
    expect(whole.gold).toBe(
      Array.from({ length: 75 }, (_, cycle) => cycleSamples[cycle % 30]!.gold).reduce(
        (sum, gold) => sum + gold,
        0,
      ),
    );
  });

  it("never pays legacy waves that come after a lost wave", () => {
    const legacyWaves = simulateDungeonCycle({ heroes, dungeonId: "bamboo_grove", seed: 99 }).map(
      (wave, index) =>
        index === 2 ? { ...wave, result: "lose" as const, rewardGold: 0, rewardExp: 0 } : wave,
    );
    const [sample] = runCycleSamples({
      waves: legacyWaves,
      cycleSamples: null,
    } as Pick<DungeonRun, "waves" | "cycleSamples">);

    expect(sample!.gold).toBe(legacyWaves[0]!.rewardGold + legacyWaves[1]!.rewardGold);
    expect(sample!.kills.boss).toBe(0);
  });
});
