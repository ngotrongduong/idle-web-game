import { GAME_CORE_VERSION, simulateWave } from "@idle/game-core";

const sample = simulateWave({
  seed: 42,
  allies: [
    { id: "hero", hp: 120, attack: 35, defense: 16, speed: 12 },
  ],
  enemies: [
    { id: "training_dummy", hp: 80, attack: 18, defense: 8, speed: 6 },
  ],
});

console.log(
  JSON.stringify(
    {
      gameCore: GAME_CORE_VERSION,
      result: sample.result,
      turns: sample.turns,
      hash: sample.hash,
    },
    null,
    2,
  ),
);
