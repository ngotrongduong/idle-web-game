import { describe, expect, it } from "vitest";
import { InMemoryGameStore } from "./store.js";
import { grantHeroExperience } from "./progression.js";

describe("grantHeroExperience", () => {
  it("uses class tier to level heroes and persists the result", async () => {
    const store = new InMemoryGameStore();
    const player = await store.createGuest("progression-session");
    const hero = await store.createHero(player.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });

    const [result] = await grantHeroExperience(store, player.id, [hero.id], 38);
    expect(result).toMatchObject({
      hero: {
        id: hero.id,
        level: 2,
        exp: 0,
      },
      levelsGained: 1,
      atLevelCap: false,
    });
    expect(await store.listHeroes(player.id)).toContainEqual({
      ...hero,
      level: 2,
      exp: 0,
    });
  });

  it("does not bank EXP past the current class tier cap", async () => {
    const store = new InMemoryGameStore();
    const player = await store.createGuest("cap-session");
    const hero = await store.createHero(player.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 10,
      exp: 0,
    });

    const [result] = await grantHeroExperience(store, player.id, [hero.id], 50_000);
    expect(result).toMatchObject({
      hero: {
        level: 10,
        exp: 0,
      },
      levelsGained: 0,
      atLevelCap: true,
    });
    expect(result?.expDiscarded).toBe(50_000);
  });
});
