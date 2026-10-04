import { Pool } from "pg";
import { type Locator, type Page } from "playwright";
import { launchBrowser } from "./browser.ts";

const url = process.env.GUILDHALL_E2E_URL ?? "http://127.0.0.1:5173";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for auto-sell E2E setup");
}

const ITEM_ID = "bamboo_training_sword";
const MAX_QUALITY_BPS = 15_000;
const MATERIALS = [
  { materialId: "bamboo_fiber", qty: 10 },
  { materialId: "river_stone", qty: 10 },
] as const;

type CommandEvent = { type: string } & Record<string, unknown>;

type CommandBody = {
  ok: true;
  version: number;
  patch: { gold?: number };
  events: CommandEvent[];
};

type InventoryItem = {
  id: string;
  itemId: string;
  qualityBps: number;
};

async function runCommand(page: Page, control: Locator): Promise<CommandBody> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/v1/cmd") &&
        candidate.request().method() === "POST",
    ),
    control.click(),
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

async function ensureGuest(page: Page): Promise<{ id: string; gold: number }> {
  return page.evaluate(async () => {
    let response = await fetch("/api/v1/state", { credentials: "include" });

    if (response.status === 401) {
      response = await fetch("/api/v1/auth/guest", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Guest bootstrap failed with ${response.status}`);
      }
      const body = (await response.json()) as {
        state: { id: string; gold: number };
      };
      return body.state;
    }

    if (!response.ok) {
      throw new Error(`GET /api/v1/state failed with ${response.status}`);
    }

    return (await response.json()) as { id: string; gold: number };
  });
}

async function seedCraftMaterials(playerId: string): Promise<void> {
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
  } finally {
    await pool.end();
  }
}

const browser = await launchBrowser();

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const state = await ensureGuest(page);
  await seedCraftMaterials(state.id);
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Rèn", exact: true }).click();

  const autoSellCard = page.locator(".auto-sell-card");
  await autoSellCard.waitFor({ state: "visible", timeout: 10_000 });

  const threshold = autoSellCard.getByLabel("Tự bán đến phẩm chất");
  const [thresholdResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/v1/cmd") &&
        candidate.request().method() === "POST",
    ),
    threshold.selectOption(String(MAX_QUALITY_BPS)),
  ]);
  if (!thresholdResponse.ok()) {
    throw new Error(
      `Updating auto-sell threshold failed with ${thresholdResponse.status()}: ${await thresholdResponse.text()}`,
    );
  }

  const toggle = autoSellCard.getByRole("checkbox");
  await page.waitForFunction(
    () => {
      const checkbox = document.querySelector(
        ".auto-sell-card input[type='checkbox']",
      );
      return checkbox instanceof HTMLInputElement && !checkbox.disabled;
    },
    undefined,
    { timeout: 10_000 },
  );

  const [toggleResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/v1/cmd") &&
        candidate.request().method() === "POST",
    ),
    toggle.check(),
  ]);
  if (!toggleResponse.ok()) {
    throw new Error(
      `Enabling auto-sell failed with ${toggleResponse.status()}: ${await toggleResponse.text()}`,
    );
  }

  const settings = await getJson<{
    autoSell: { enabled: boolean; maxQualityBps: number };
  }>(page, "/api/v1/inventory-settings");
  if (!settings.autoSell.enabled || settings.autoSell.maxQualityBps !== MAX_QUALITY_BPS) {
    throw new Error(`Unexpected persisted auto-sell settings: ${JSON.stringify(settings)}`);
  }

  const before = await getJson<{ gold: number }>(page, "/api/v1/state");
  const catalog = await getJson<{
    items: Array<{ id: string; sellGold: number }>;
  }>(page, "/api/v1/catalog");
  const spec = catalog.items.find((item) => item.id === ITEM_ID);
  if (!spec) throw new Error(`Missing catalog item ${ITEM_ID}`);

  const craftRow = page.locator(`.craft-row[data-item-id="${ITEM_ID}"]`);
  await craftRow.waitFor({ state: "visible", timeout: 10_000 });
  const craft = await runCommand(
    page,
    craftRow.getByRole("button", { name: "Chế tạo", exact: true }),
  );

  const crafted = craft.events.find((event) => event.type === "item_crafted");
  const autoSold = craft.events.find((event) => event.type === "item_auto_sold");
  if (!crafted || !autoSold) {
    throw new Error(`Expected item_crafted + item_auto_sold: ${JSON.stringify(craft.events)}`);
  }

  const item = autoSold.item as InventoryItem;
  const creditedGold = Number(autoSold.gold);
  const expectedGold = Math.floor((spec.sellGold * item.qualityBps) / 10_000);
  if (creditedGold !== expectedGold) {
    throw new Error(
      `Auto-sell gold mismatch: expected ${expectedGold}, got ${creditedGold}`,
    );
  }

  const inventory = await getJson<{ items: InventoryItem[] }>(page, "/api/v1/inventory");
  if (inventory.items.some((entry) => entry.id === item.id)) {
    throw new Error("Auto-sold crafted item still exists in inventory");
  }

  const after = await getJson<{ gold: number }>(page, "/api/v1/state");
  if (after.gold !== before.gold + expectedGold) {
    throw new Error(
      `Player gold mismatch after auto-sell: expected ${before.gold + expectedGold}, got ${after.gold}`,
    );
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Rèn", exact: true }).click();
  const persistedCard = page.locator(".auto-sell-card");
  await persistedCard.waitFor({ state: "visible", timeout: 10_000 });

  if (!(await persistedCard.getByRole("checkbox").isChecked())) {
    throw new Error("Auto-sell enabled state did not survive reload");
  }
  if ((await persistedCard.getByLabel("Tự bán đến phẩm chất").inputValue()) !== String(MAX_QUALITY_BPS)) {
    throw new Error("Auto-sell threshold did not survive reload");
  }

  console.log(
    `Auto-sell E2E passed: ${ITEM_ID} quality ${item.qualityBps} sold for ${creditedGold} gold and settings persisted.`,
  );
} finally {
  await browser.close();
}
