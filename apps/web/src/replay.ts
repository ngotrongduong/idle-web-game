import { simulateWave, type BattleRules, type Combatant } from "@idle/game-core";

export type ReplayWaveSnapshot = {
  wave: number;
  seed: number;
  hash: string;
  allies: Combatant[];
  enemies: Combatant[];
};

export type ReplayRunSnapshot = {
  battleRules: BattleRules;
  waves: ReplayWaveSnapshot[];
};

export type ReplayVerification = {
  ok: boolean;
  waves: {
    wave: number;
    expectedHash: string;
    actualHash: string;
    matches: boolean;
  }[];
};

export function verifyDungeonRunReplay(run: ReplayRunSnapshot): ReplayVerification {
  const waves = run.waves.map((wave) => {
    const replayed = simulateWave({
      allies: wave.allies,
      enemies: wave.enemies,
      seed: wave.seed,
      rules: run.battleRules,
    });

    return {
      wave: wave.wave,
      expectedHash: wave.hash,
      actualHash: replayed.hash,
      matches: replayed.hash === wave.hash,
    };
  });

  return {
    ok: waves.every((wave) => wave.matches),
    waves,
  };
}
