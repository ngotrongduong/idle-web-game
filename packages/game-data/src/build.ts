import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameDataFromCsv } from "./csv";
import { validateMvpContentSlice } from "./schema";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const [
  materials,
  items,
  dungeons,
  classes,
  enemies,
  skills,
  bosses,
  waves,
] = await Promise.all([
  readFile(resolve(root, "data/materials.csv"), "utf8"),
  readFile(resolve(root, "data/items.csv"), "utf8"),
  readFile(resolve(root, "data/dungeons.csv"), "utf8"),
  readFile(resolve(root, "data/classes.csv"), "utf8"),
  readFile(resolve(root, "data/enemies.csv"), "utf8"),
  readFile(resolve(root, "data/skills.csv"), "utf8"),
  readFile(resolve(root, "data/bosses.csv"), "utf8"),
  readFile(resolve(root, "data/waves.csv"), "utf8"),
]);

const gameData = validateMvpContentSlice(
  loadGameDataFromCsv(
    {
      materials,
      items,
      dungeons,
      classes,
      enemies,
      skills,
      bosses,
      waves,
    },
    "m0.3-mvp-slice",
  ),
);

const outputDir = resolve(root, "generated");
await mkdir(outputDir, { recursive: true });
await writeFile(
  resolve(outputDir, "config.json"),
  `${JSON.stringify(gameData, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `game-data: ${gameData.classes.length} classes`,
    `${gameData.skills.length} skills`,
    `${gameData.dungeons.length} dungeons`,
    `${gameData.enemies.length} enemies`,
    `${gameData.bosses.length} bosses`,
    `${gameData.waves.length} waves`,
    `${gameData.items.length} items`,
    `${gameData.materials.length} materials`,
  ].join(", "),
);
