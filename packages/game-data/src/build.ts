import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameDataFromCsv } from "./csv";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const [materials, items, dungeons, classFamilies, classes, enemies] =
  await Promise.all([
    readFile(resolve(root, "data/materials.csv"), "utf8"),
    readFile(resolve(root, "data/items.csv"), "utf8"),
    readFile(resolve(root, "data/dungeons.csv"), "utf8"),
    readFile(resolve(root, "data/class-families.csv"), "utf8"),
    readFile(resolve(root, "data/classes.csv"), "utf8"),
    readFile(resolve(root, "data/enemies.csv"), "utf8"),
  ]);

const gameData = loadGameDataFromCsv(
  { materials, items, dungeons, classFamilies, classes, enemies },
  "m0.3-content-v3",
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
    `game-data: ${gameData.materials.length} materials`,
    `${gameData.items.length} items`,
    `${gameData.dungeons.length} dungeons`,
    `${gameData.classFamilies.length} families`,
    `${gameData.classes.length} classes`,
    `${gameData.enemies.length} enemies`,
  ].join(", "),
);
