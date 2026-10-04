import { Pool } from "pg";
import { type Locator, type Page } from "playwright";
import { launchBrowser } from "./browser.ts";

const url = process.env.GUILDHALL_E2E_URL ?? "http://127.0.0.1:5173";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for equipment E2E setup");
}

const ITEM_ID = "bamboo_training_sword";
const FORGE_DUST = "forge_dust";
// Enhancing needs a level 2 Forge and Forge Dust (M1.7). The buildings E2E earns both through
// the UI; this flow is about equipment, so it starts with them in place.
const SEEDED_FORGE_LEVEL = 2;
const SEEDED_DUST = 3;
// packages/game-data/src/equipment.ts: the first enhancement costs 100 gold and 1 Forge Dust.
const ENHANCE_FROM_0 = { gold: 100, dust: 1 };
const MATERIALS = [
  { materialId: "bamboo_fiber", qty: 10 },
  { materialId: "river_stone", qty: 10 },
  { materialId: FORGE_DUST, qty: SEEDED_DUST },
] as const;

type CommandBody = {
  ok: true;
  events: Array<{ type: string } & Record<string, unknown>>;
};

type Hero = {
  id: string;
  classId: string;
  level: number;
};

type InventoryItem = {
  id: string;
  itemId: string;
  qualityBps: number;
  enhanceLevel: number;
  enhancePityFailures: number;
  equippedHeroId: string | null;
};

type DungeonRun = {
  id: string;
  status: "active" | "stopped";
  waves: Array<{
    allies: Array<{ id: string; attack: number; defense: number }>;
  }>;
};

async function runCommand(page: Page, button: Locator): Promise<CommandBody> {
  const deadline = Date.now() + 15_000;
  await button.waitFor({ state: "visible", timeout: 15_000 });
  while (!(await button.isEnabled())) {
    if (Date.now() > deadline) {
      throw new Error(`Button stayed disabled: ${await button.textContent()}`);
    }
    await page.waitForTimeout(100);
  }

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/v1/cmd") &&
        candidate.request().method() === "POST",
    ),
    button.click(),
  ]);

  if (!response.ok()) {
    throw new Error(
      `Command failed with ${response.status()}: ${await response.text()}`,
    );
  }
  return (await response.json()) as CommandBody;
}

async function getJson<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { credentials: "include" });
    if (!response.ok) throw new Error(`GET ${target} failed with ${response.status}`);
    return response.json();
  }, path) as Promise<T>;
}

async function seedForgeAndMaterials(playerId: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    for (const material of MATERIALS) {
      await pool.query(
        `INSERT INTO player_materials (player_id, material_id, qty)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, material_id)
         DO UPDATE SET qty = EXCLUDED.qty, updated_at = now()`,
        [playerId, material.materialId, material.qty],
      );
    }
    const forge = await pool.query("UPDATE players SET forge_level = $2 WHERE id = $1", [
      playerId,
      SEEDED_FORGE_LEVEL,
    ]);
    if (forge.rowCount !== 1) throw new Error(`Player ${playerId} was not found for seeding`);
  } finally {
    await pool.end();
  }
}

async function forgeDust(page: Page): Promise<number> {
  const { materials } = await getJson<{ materials: Array<{ materialId: string; qty: number }> }>(
    page,
    "/api/v1/materials",
  );
  return materials.find((entry) => entry.materialId === FORGE_DUST)?.qty ?? 0;
}

async function openDungeon(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Đội & Hầm", exact: true }).click();
  const team = page.locator(".team-card").first();
  await team.waitFor({ state: "visible", timeout: 10_000 });
  return team;
}

async function latestRun(page: Page): Promise<DungeonRun> {
  const { runs } = await getJson<{ runs: DungeonRun[] }>(page, "/api/v1/dungeon-runs");
  const run = [...runs].at(-1);
  if (!run) throw new Error("Expected a dungeon run");
  return run;
}

const browser = await launchBrowser();

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await runCommand(page, page.getByRole("button", { name: "Làm mới", exact: true }));
  await runCommand(page, page.getByRole("button", { name: "Tuyển", exact: true }).first());

  const { id: playerId } = await getJson<{ id: string }>(page, "/api/v1/state");
  const { heroes } = await getJson<{ heroes: Hero[] }>(page, "/api/v1/heroes");
  const hero = heroes[0];
  if (!hero) throw new Error("Expected recruited hero");

  let team = await openDungeon(page);
  const firstChoice = team.locator('input[type="checkbox"]').first();
  await firstChoice.check();
  await runCommand(page, team.getByRole("button", { name: "Lưu đội", exact: true }));
  await runCommand(page, team.getByRole("button", { name: "Bắt đầu", exact: true }));

  const baseline = await latestRun(page);
  const baselineAttack = baseline.waves[0]?.allies[0]?.attack;
  if (!baselineAttack) throw new Error("Expected baseline ally attack snapshot");

  team = await openDungeon(page);
  await runCommand(page, team.getByRole("button", { name: "Dừng", exact: true }));

  await seedForgeAndMaterials(playerId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Rèn", exact: true }).click();
  const seeded = await getJson<{ id: string; forgeLevel: number }>(page, "/api/v1/state");
  if (seeded.id !== playerId || seeded.forgeLevel !== SEEDED_FORGE_LEVEL) {
    throw new Error(`Seeded Forge level did not reach the session: ${JSON.stringify(seeded)}`);
  }

  const craftRow = page.locator(`.craft-row[data-item-id="${ITEM_ID}"]`);
  await craftRow.waitFor({ state: "visible", timeout: 10_000 });
  const craftBody = await runCommand(
    page,
    craftRow.getByRole("button", { name: "Chế tạo", exact: true }),
  );
  const craftedEvent = craftBody.events.find((event) => event.type === "item_crafted");
  if (!craftedEvent) throw new Error("Craft did not emit item_crafted");

  const equipmentCard = page.locator(`.equipment-card[data-item-id="${ITEM_ID}"]`).first();
  await equipmentCard.waitFor({ state: "visible", timeout: 10_000 });

  const { gold: goldBeforeEnhance } = await getJson<{ gold: number }>(page, "/api/v1/state");
  const enhanceBody = await runCommand(
    page,
    equipmentCard.getByRole("button", { name: "Cường hóa", exact: true }),
  );
  const enhancedEvent = enhanceBody.events.find((event) => event.type === "item_enhanced");
  if (!enhancedEvent || enhancedEvent.success !== true) {
    throw new Error(`Expected guaranteed +1 enhancement: ${JSON.stringify(enhanceBody.events)}`);
  }
  if (
    enhancedEvent.goldCost !== ENHANCE_FROM_0.gold ||
    enhancedEvent.dustCost !== ENHANCE_FROM_0.dust
  ) {
    throw new Error(`Unexpected enhancement cost: ${JSON.stringify(enhancedEvent)}`);
  }
  const { gold: goldAfterEnhance } = await getJson<{ gold: number }>(page, "/api/v1/state");
  const dustAfterEnhance = await forgeDust(page);
  if (
    goldAfterEnhance !== goldBeforeEnhance - ENHANCE_FROM_0.gold ||
    dustAfterEnhance !== SEEDED_DUST - ENHANCE_FROM_0.dust
  ) {
    throw new Error(
      `Enhancement charged the wrong amount: gold ${goldBeforeEnhance} → ${goldAfterEnhance}, dust ${SEEDED_DUST} → ${dustAfterEnhance}`,
    );
  }

  await runCommand(
    page,
    equipmentCard.getByRole("button", { name: "Trang bị", exact: true }),
  );

  const { items } = await getJson<{ items: InventoryItem[] }>(page, "/api/v1/inventory");
  const item = items.find((entry) => entry.itemId === ITEM_ID);
  if (
    !item ||
    item.enhanceLevel !== 1 ||
    item.enhancePityFailures !== 0 ||
    item.equippedHeroId !== hero.id
  ) {
    throw new Error(`Unexpected equipped crafted item: ${JSON.stringify(item)}`);
  }

  team = await openDungeon(page);
  await runCommand(page, team.getByRole("button", { name: "Bắt đầu", exact: true }));

  const equippedRun = await latestRun(page);
  const equippedAttack = equippedRun.waves[0]?.allies[0]?.attack;
  if (!equippedAttack || equippedAttack <= baselineAttack) {
    throw new Error(
      `Expected equipment to increase attack: baseline ${baselineAttack}, equipped ${equippedAttack}`,
    );
  }

  await team
    .getByText("Replay client đã khớp server", { exact: true })
    .waitFor({ state: "visible", timeout: 10_000 });

  console.log(
    `Equipment E2E passed: ${ITEM_ID} crafted, enhanced to +1 at Forge level ${SEEDED_FORGE_LEVEL} for ${ENHANCE_FROM_0.gold} gold + ${ENHANCE_FROM_0.dust} Forge Dust, equipped to ${hero.id}; dungeon attack ${baselineAttack} → ${equippedAttack} and replay matched.`,
  );
} finally {
  await browser.close();
}
