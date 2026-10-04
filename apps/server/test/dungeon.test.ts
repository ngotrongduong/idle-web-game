import { describe, expect, it } from "vitest";
import type { Hero } from "@idle/api-contract";
import { foundationGameData } from "@idle/game-data";
import {
  deriveWaveSeed,
  heroToCombatant,
  simulateDungeonCycle,
} from "../src/dungeon.js";

const heroes: Hero[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    classId: "ward_squire",
    rarity: "common",
    level: 1,
    exp: 0,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    classId: "trail_archer",
    rarity: "elite",
    level: 1,
    exp: 0,
  },
];

describe("dungeon replay generation", () => {
  it("replays the same six waves identically for the same seed", () => {
    const left = simulateDungeonCycle({
      heroes,
      dungeonId: "bamboo_grove",
      seed: 123_456,
    });
    const right = simulateDungeonCycle({
      heroes,
      dungeonId: "bamboo_grove",
      seed: 123_456,
    });

    expect(left).toEqual(right);
    expect(left).toHaveLength(6);
    expect(left.map((wave) => wave.seed)).toEqual(
      Array.from({ length: 6 }, (_, index) =>
        deriveWaveSeed(123_456, index + 1),
      ),
    );
  });

  it("snapshots the configured boss in the final wave", () => {
    const waves = simulateDungeonCycle({
      heroes,
      dungeonId: "bamboo_grove",
      seed: 42,
    });
    const boss = foundationGameData.enemies.find(
      (enemy) =>
        enemy.dungeonId === "bamboo_grove" && enemy.rank === "boss",
    );

    expect(boss).toBeDefined();
    expect(waves[5]?.enemies.map((enemy) => enemy.id)).toEqual([boss!.id]);
    expect(waves.every((wave) => /^[0-9a-f]{8}$/.test(wave.hash))).toBe(true);
  });

  it("applies rarity to the persisted hero combat snapshot", () => {
    const common = heroToCombatant(heroes[0]!);
    const rare = heroToCombatant({
      ...heroes[0]!,
      rarity: "rare",
    });

    expect(rare.hp).toBeGreaterThan(common.hp);
    expect(rare.attack).toBeGreaterThan(common.attack);
    expect(rare.defense).toBeGreaterThan(common.defense);
  });
});
