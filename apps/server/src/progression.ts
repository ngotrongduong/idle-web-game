import type { Hero } from "@idle/api-contract";
import { foundationGameData } from "@idle/game-data";
import { applyHeroExperience } from "@idle/game-core";
import type { GameStore } from "./store.js";

export type GrantedHeroExperience = {
  hero: Hero;
  levelsGained: number;
  expDiscarded: number;
  atLevelCap: boolean;
};

export async function grantHeroExperience(
  store: GameStore,
  playerId: string,
  heroIds: string[],
  expEach: number,
): Promise<GrantedHeroExperience[]> {
  if (!Number.isInteger(expEach) || expEach < 0) {
    throw new Error("Hero EXP grant must be a non-negative integer");
  }

  const targetIds = new Set(heroIds);
  const heroes = (await store.listHeroes(playerId)).filter((hero) => targetIds.has(hero.id));
  if (heroes.length !== targetIds.size) {
    throw new Error("Hero EXP grant references a missing hero");
  }

  const results = heroes.map((hero) => {
    const heroClass = foundationGameData.classes.find((entry) => entry.id === hero.classId);
    if (!heroClass) {
      throw new Error(`Unknown hero class: ${hero.classId}`);
    }

    const progress = applyHeroExperience(
      {
        level: hero.level,
        exp: hero.exp,
        tier: heroClass.tier,
      },
      expEach,
    );

    return {
      hero: {
        ...hero,
        level: progress.level,
        exp: progress.exp,
      },
      levelsGained: progress.levelsGained,
      expDiscarded: progress.expDiscarded,
      atLevelCap: progress.atLevelCap,
    };
  });

  await store.setHeroProgress(
    playerId,
    results.map(({ hero }) => ({
      id: hero.id,
      level: hero.level,
      exp: hero.exp,
    })),
  );

  return results;
}
