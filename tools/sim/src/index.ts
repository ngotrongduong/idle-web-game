import { runBattleSimulation } from "./battle-sim";
import { runEconomySimulation } from "./economy-sim";
import { runGachaSimulation } from "./gacha-sim";
import { runUpgradeSimulation } from "./upgrade-sim";

function readNumberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const raw = process.argv[index + 1];
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) {
    throw new Error(`--${name} requires a numeric value`);
  }
  return value;
}

function readStringArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const raw = process.argv[index + 1];
  if (!raw) throw new Error(`--${name} requires a value`);
  return raw;
}

const command = process.argv[2];

if (command === "battle") {
  const encounterId = readStringArg("encounter");
  const summary = runBattleSimulation({
    runs: readNumberArg("runs", 10_000),
    seedBase: readNumberArg("seed", 1),
    ...(encounterId === undefined ? {} : { encounterId }),
  });
  console.log(JSON.stringify(summary, null, 2));
} else if (command === "gacha") {
  const summary = runGachaSimulation({
    runs: readNumberArg("runs", 20_000),
    seedBase: readNumberArg("seed", 1),
  });
  console.log(JSON.stringify(summary, null, 2));
} else if (command === "economy") {
  console.log(JSON.stringify(runEconomySimulation(), null, 2));
} else if (command === "upgrade") {
  const summary = runUpgradeSimulation({
    runs: readNumberArg("runs", 20_000),
    seedBase: readNumberArg("seed", 1),
    targetLevel: readNumberArg("target", 10),
  });
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(
    [
      "Usage:",
      "  pnpm sim:battle -- --runs 10000 [--encounter dungeon_1] [--seed 1]",
      "  pnpm sim:upgrade -- --runs 20000 [--target 10] [--seed 1]",
      "  pnpm sim:gacha -- --runs 20000 [--seed 1]",
      "  pnpm --filter @idle/sim sim:economy",
    ].join("\n"),
  );
}
