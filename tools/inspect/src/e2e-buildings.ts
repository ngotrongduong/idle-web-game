import { Pool } from "pg";
import { type Locator, type Page } from "playwright";
import { launchBrowser } from "./browser.ts";

const url = process.env.GUILDHALL_E2E_URL ?? "http://127.0.0.1:5173";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for buildings E2E setup");
}

// Expected numbers are restated from the design data instead of being read from the API under
// test, so a wrong catalog or a wrong charge fails here.
// packages/game-data/data/buildings.json
const HALL_L1_UPGRADE = { gold: 300, seconds: 60 };
const FORGE_L1_UPGRADE = { gold: 240, seconds: 48, materialId: "river_stone", qty: 3 };
const HOURGLASS = "builders_hourglass";
const HOURGLASS_SECONDS = 300;
// packages/game-core/src/economy.ts: hero capacity is 3 + Hall level.
const HERO_CAPACITY = { hall1: 4, hall2: 5 };
// packages/game-data/src/equipment.ts
const FORGE_DUST = "forge_dust";
const ENHANCE_FROM_0 = { gold: 100, dust: 1 };
/** What the item card offers once the item is +1: 160 gold, 2 Forge Dust, 95% base chance. */
const ENHANCE_FROM_1_TEXT = "Lần cường hóa tiếp: 160 vàng · 2 Bụi Rèn · 95%";
const DISMANTLE_DUST_BY_QUALITY: Record<number, number> = {
  10_000: 1,
  11_000: 2,
  12_000: 3,
  13_000: 5,
};
// Chance of a Common craft: 70% at Forge level 1, 67% at level 2 (buildings.json).
const COMMON_ODDS = { forge1: "Thường 70%", forge2: "Thường 67%" };
// packages/game-data/data/items.csv
const ITEM_ID = "bamboo_training_sword";
const RECIPE = [
  { materialId: "bamboo_fiber", qty: 3 },
  { materialId: "river_stone", qty: 1 },
] as const;

const CRAFTS = 2;
const SEEDED_HOURGLASSES = 3;
/** Exactly what two crafts and the Forge upgrade consume, so every balance must end at zero. */
const SEEDED_MATERIALS = [
  { materialId: "bamboo_fiber", qty: RECIPE[0].qty * CRAFTS },
  { materialId: "river_stone", qty: RECIPE[1].qty * CRAFTS + FORGE_L1_UPGRADE.qty },
  { materialId: HOURGLASS, qty: SEEDED_HOURGLASSES },
];
/** Seconds left on the Hall build after the script moves it into the past. */
const SECONDS_LEFT_AFTER_BACKDATE = 4;

type Construction = {
  building: "hall" | "forge";
  targetLevel: number;
  startedAt: string;
  completesAt: string;
};

type PlayerState = {
  id: string;
  version: number;
  gold: number;
  hallLevel: number;
  forgeLevel: number;
  construction: Construction | null;
};

type Buildings = {
  serverTime: string;
  hallLevel: number;
  forgeLevel: number;
  construction: Construction | null;
};

type MaterialBalance = { materialId: string; qty: number };

type InventoryItem = {
  id: string;
  itemId: string;
  qualityBps: number;
  enhanceLevel: number;
};

type CommandBody = {
  ok: true;
  version: number;
  patch: Partial<Pick<PlayerState, "gold" | "hallLevel" | "forgeLevel" | "construction">>;
  events: Array<{ type: string } & Record<string, unknown>>;
};

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function runCommand(page: Page, button: Locator): Promise<CommandBody> {
  // The UI disables controls while it reloads after the previous command; clicking a disabled
  // button sends no request, so wait until the control is usable first.
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
        candidate.url().endsWith("/api/v1/cmd") && candidate.request().method() === "POST",
    ),
    button.click(),
  ]);

  if (!response.ok()) {
    throw new Error(`Command failed with ${response.status()}: ${await response.text()}`);
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

/** Sends a command the UI would not let the player send, to see the server refuse it. */
async function sendRawCommand(
  page: Page,
  command: Record<string, unknown>,
): Promise<{ status: number; code: string | undefined }> {
  return page.evaluate(async (payload) => {
    const state = (await (await fetch("/api/v1/state", { credentials: "include" })).json()) as {
      version: number;
    };
    const response = await fetch("/api/v1/cmd", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cmdId: crypto.randomUUID(),
        expectVersion: state.version,
        command: payload,
      }),
    });
    const body = (await response.json()) as { code?: string };
    return { status: response.status, code: body.code };
  }, command);
}

/** The element's text right now, or undefined while it is not on screen. */
async function textNow(locator: Locator): Promise<string | undefined> {
  return (await locator.textContent({ timeout: 500 }).catch(() => null))?.trim();
}

/** Waits until the element shows exactly `expected`; the app re-renders after its own fetches. */
async function expectText(locator: Locator, expected: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const actual = await textNow(locator);
    if (actual === expected) return;
    if (Date.now() > deadline) {
      throw new Error(`Expected "${expected}" on screen, got "${actual}"`);
    }
    await locator.page().waitForTimeout(100);
  }
}

async function expectContains(locator: Locator, part: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const actual = await textNow(locator);
    if (actual?.includes(part)) return;
    if (Date.now() > deadline) {
      throw new Error(`Expected text containing "${part}" on screen, got "${actual}"`);
    }
    await locator.page().waitForTimeout(100);
  }
}

async function expectDisabled(locator: Locator, label: string): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 10_000 });
  if (await locator.isEnabled()) throw new Error(`${label} should be disabled`);
}

function qtyOf(materials: MaterialBalance[], materialId: string): number {
  return materials.find((entry) => entry.materialId === materialId)?.qty ?? 0;
}

async function materialQty(page: Page, materialId: string): Promise<number> {
  const { materials } = await getJson<{ materials: MaterialBalance[] }>(page, "/api/v1/materials");
  return qtyOf(materials, materialId);
}

function secondsOf(countdown: string): number {
  const match = /^(\d+):(\d{2})$/.exec(countdown);
  if (!match) throw new Error(`Countdown "${countdown}" is not m:ss`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function buildSeconds(construction: Construction): number {
  return (Date.parse(construction.completesAt) - Date.parse(construction.startedAt)) / 1_000;
}

async function openTab(page: Page, name: "Hội Quán" | "Rèn" | "Tuyển Mộ"): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

/** The app has finished its guest bootstrap once the Tavern's refresh button is there. */
async function waitForApp(page: Page): Promise<PlayerState> {
  await page
    .getByRole("button", { name: "Làm mới", exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
  return getJson<PlayerState>(page, "/api/v1/state");
}

const pool = new Pool({ connectionString: databaseUrl });

async function seedMaterials(playerId: string): Promise<void> {
  for (const material of SEEDED_MATERIALS) {
    await pool.query(
      `INSERT INTO player_materials (player_id, material_id, qty)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, material_id)
       DO UPDATE SET qty = EXCLUDED.qty, updated_at = now()`,
      [playerId, material.materialId, material.qty],
    );
  }
}

/** Moves the running construction into the past, keeping its duration. */
async function backdateConstruction(playerId: string, construction: Construction, byMs: number) {
  const result = await pool.query(
    `UPDATE players
     SET construction = construction
       || jsonb_build_object('startedAt', $2::text, 'completesAt', $3::text)
     WHERE id = $1 AND construction IS NOT NULL`,
    [
      playerId,
      new Date(Date.parse(construction.startedAt) - byMs).toISOString(),
      new Date(Date.parse(construction.completesAt) - byMs).toISOString(),
    ],
  );
  if (result.rowCount !== 1) throw new Error("No running construction to backdate");
}

const browser = await launchBrowser();

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Let the app create its guest first, then seed that player and reload so the page sees it.
  const fresh = await waitForApp(page);
  await seedMaterials(fresh.id);
  await page.reload({ waitUntil: "domcontentloaded" });
  const start = await waitForApp(page);
  if (start.id !== fresh.id) {
    throw new Error(`Session switched players after reload: ${fresh.id} -> ${start.id}`);
  }
  assertEqual(
    { hallLevel: start.hallLevel, forgeLevel: start.forgeLevel, construction: start.construction },
    { hallLevel: 1, forgeLevel: 1, construction: null },
    "fresh guest buildings",
  );
  // From here until the reload at the very end, the page must update on its own.
  await page.evaluate(() => {
    (window as unknown as { __buildingsE2E?: boolean }).__buildingsE2E = true;
  });

  // --- 1. Start a Hall upgrade: gold is paid at once, the level waits for the timer. ----------
  await openTab(page, "Hội Quán");
  const hallLevel = page.getByTestId("hall-level");
  const forgeLevel = page.getByTestId("forge-level");
  const guildGold = page.getByTestId("guild-gold");
  await expectText(hallLevel, "1");
  await expectText(page.getByTestId("hall-hero-capacity"), String(HERO_CAPACITY.hall1));
  await expectText(guildGold, String(start.gold));
  await page.getByTestId("builder-idle").waitFor({ state: "visible", timeout: 10_000 });

  const hallStart = await runCommand(page, page.getByTestId("upgrade-hall"));
  const hallStarted = hallStart.events.find((event) => event.type === "building_upgrade_started");
  if (!hallStarted) throw new Error(`Hall upgrade did not start: ${JSON.stringify(hallStart)}`);
  assertEqual(
    {
      building: hallStarted.building,
      fromLevel: hallStarted.fromLevel,
      toLevel: hallStarted.toLevel,
      goldCost: hallStarted.goldCost,
      seconds: buildSeconds(hallStarted.construction as Construction),
    },
    {
      building: "hall",
      fromLevel: 1,
      toLevel: 2,
      goldCost: HALL_L1_UPGRADE.gold,
      seconds: HALL_L1_UPGRADE.seconds,
    },
    "Hall upgrade event",
  );

  const goldAfterHall = start.gold - HALL_L1_UPGRADE.gold;
  await expectText(guildGold, String(goldAfterHall));
  await expectText(hallLevel, "1");
  await expectContains(page.getByTestId("construction-target"), "Sảnh Hội");
  const countdown = page.getByTestId("construction-countdown");
  await countdown.waitFor({ state: "visible", timeout: 10_000 });
  const shownSeconds = secondsOf((await textNow(countdown)) ?? "");
  if (shownSeconds < 1 || shownSeconds > HALL_L1_UPGRADE.seconds) {
    throw new Error(`Hall countdown shows ${shownSeconds}s, expected 1..${HALL_L1_UPGRADE.seconds}`);
  }
  await page.getByTestId("construction-progress").waitFor({ state: "visible", timeout: 10_000 });

  const building = await getJson<PlayerState>(page, "/api/v1/state");
  assertEqual(
    {
      gold: building.gold,
      hallLevel: building.hallLevel,
      building: building.construction?.building,
      targetLevel: building.construction?.targetLevel,
    },
    { gold: goldAfterHall, hallLevel: 1, building: "hall", targetLevel: 2 },
    "state while the Hall is being built",
  );

  // --- 2. One builder: a second upgrade is refused by the UI and by the server. --------------
  await expectDisabled(page.getByTestId("upgrade-hall"), "Hall upgrade while building");
  await expectDisabled(page.getByTestId("upgrade-forge"), "Forge upgrade while building");
  await expectContains(page.getByTestId("upgrade-forge-reason"), "Thợ xây đang bận");

  const refused = await sendRawCommand(page, { type: "upgrade_building", building: "forge" });
  assertEqual(refused, { status: 409, code: "BUILDER_BUSY" }, "second upgrade");
  const afterRefusal = await getJson<PlayerState>(page, "/api/v1/state");
  assertEqual(
    { version: afterRefusal.version, gold: afterRefusal.gold },
    { version: building.version, gold: goldAfterHall },
    "state after the refused upgrade",
  );
  assertEqual(
    await materialQty(page, FORGE_L1_UPGRADE.materialId),
    SEEDED_MATERIALS[1]!.qty,
    "materials after the refused upgrade",
  );

  // --- 3. The build finishes: the open page shows Hall level 2 without a reload. --------------
  const running = await getJson<Buildings>(page, "/api/v1/buildings");
  if (!running.construction) throw new Error("Expected the Hall construction to be running");
  await backdateConstruction(
    start.id,
    running.construction,
    Date.parse(running.construction.completesAt) -
      Date.parse(running.serverTime) -
      SECONDS_LEFT_AFTER_BACKDATE * 1_000,
  );
  // The page still counts down to the old deadline; re-entering the Guild tab re-reads the
  // buildings, and the last seconds then run out on the page's own countdown.
  await openTab(page, "Tuyển Mộ");
  await openTab(page, "Hội Quán");
  let resyncedSeconds: number | null = null;
  const resyncDeadline = Date.now() + 3_000;
  while (resyncedSeconds === null && Date.now() < resyncDeadline) {
    if ((await textNow(hallLevel)) === "2") break;
    const text = (await textNow(countdown)) ?? "";
    if (/^\d+:\d{2}$/.test(text) && secondsOf(text) <= SECONDS_LEFT_AFTER_BACKDATE) {
      resyncedSeconds = secondsOf(text);
    } else {
      await page.waitForTimeout(100);
    }
  }

  await expectText(hallLevel, "2", 20_000);
  await page.getByTestId("builder-idle").waitFor({ state: "visible", timeout: 10_000 });
  await expectText(page.getByTestId("hall-hero-capacity"), String(HERO_CAPACITY.hall2));
  await expectText(guildGold, String(goldAfterHall));

  const hallDone = await getJson<PlayerState>(page, "/api/v1/state");
  assertEqual(
    {
      // Settling a finished build is not a player command, so the version does not move.
      version: hallDone.version,
      gold: hallDone.gold,
      hallLevel: hallDone.hallLevel,
      forgeLevel: hallDone.forgeLevel,
      construction: hallDone.construction,
    },
    {
      version: building.version,
      gold: goldAfterHall,
      hallLevel: 2,
      forgeLevel: 1,
      construction: null,
    },
    "state after the Hall build",
  );

  await openTab(page, "Tuyển Mộ");
  await expectContains(page.locator(".tavern-header strong"), `0/${HERO_CAPACITY.hall2}`);

  // --- 4. Forge level 1: crafting works, enhancement is locked. ------------------------------
  await openTab(page, "Rèn");
  await expectText(page.getByTestId("forge-tab-level"), "1");
  await expectText(page.getByTestId("forge-tab-enhance-cap"), "chưa mở");
  await expectContains(page.getByTestId("craft-odds"), COMMON_ODDS.forge1);

  const craftButton = page
    .locator(`.craft-row[data-item-id="${ITEM_ID}"]`)
    .getByRole("button", { name: "Chế tạo", exact: true });
  const crafted: InventoryItem[] = [];
  for (let index = 0; index < CRAFTS; index += 1) {
    const craft = await runCommand(page, craftButton);
    const event = craft.events.find((entry) => entry.type === "item_crafted");
    if (!event) throw new Error(`Craft did not emit item_crafted: ${JSON.stringify(craft)}`);
    crafted.push(event.item as InventoryItem);
  }
  const [scrap, keeper] = crafted as [InventoryItem, InventoryItem];
  const scrapCard = page.locator(`.equipment-card[data-instance-id="${scrap.id}"]`);
  const keeperCard = page.locator(`.equipment-card[data-instance-id="${keeper.id}"]`);
  await keeperCard.waitFor({ state: "visible", timeout: 10_000 });

  await expectDisabled(keeperCard.getByTestId("enhance-item"), "Enhance at Forge level 1");
  await expectText(keeperCard.getByTestId("enhance-reason"), "Cần Lò Rèn cấp 2");
  const tooEarly = await sendRawCommand(page, { type: "enhance_item", itemInstanceId: keeper.id });
  assertEqual(tooEarly, { status: 409, code: "FORGE_LEVEL_TOO_LOW" }, "enhance at Forge level 1");

  // --- 5. Forge upgrade: gold and the listed materials are consumed, the level waits. ---------
  await openTab(page, "Hội Quán");
  const forgeMaterialRow = page.locator(
    `[data-testid="upgrade-forge-cost"] li[data-material-id="${FORGE_L1_UPGRADE.materialId}"] strong`,
  );
  await expectText(forgeMaterialRow, `${FORGE_L1_UPGRADE.qty}/${FORGE_L1_UPGRADE.qty}`);

  const forgeStart = await runCommand(page, page.getByTestId("upgrade-forge"));
  const forgeStarted = forgeStart.events.find((event) => event.type === "building_upgrade_started");
  if (!forgeStarted) throw new Error(`Forge upgrade did not start: ${JSON.stringify(forgeStart)}`);
  assertEqual(
    {
      building: forgeStarted.building,
      toLevel: forgeStarted.toLevel,
      goldCost: forgeStarted.goldCost,
      consumedMaterials: forgeStarted.consumedMaterials,
      seconds: buildSeconds(forgeStarted.construction as Construction),
    },
    {
      building: "forge",
      toLevel: 2,
      goldCost: FORGE_L1_UPGRADE.gold,
      consumedMaterials: [{ materialId: FORGE_L1_UPGRADE.materialId, qty: FORGE_L1_UPGRADE.qty }],
      seconds: FORGE_L1_UPGRADE.seconds,
    },
    "Forge upgrade event",
  );

  const goldAfterForge = goldAfterHall - FORGE_L1_UPGRADE.gold;
  await expectText(guildGold, String(goldAfterForge));
  await expectText(forgeLevel, "1");
  await expectContains(page.getByTestId("construction-target"), "Lò Rèn");
  await expectText(forgeMaterialRow, `0/${FORGE_L1_UPGRADE.qty}`);
  assertEqual(
    await materialQty(page, FORGE_L1_UPGRADE.materialId),
    0,
    "Forge material after the upgrade started",
  );

  // Still locked while the Forge is being built.
  await openTab(page, "Rèn");
  await page.getByTestId("construction-note").waitFor({ state: "visible", timeout: 10_000 });
  await expectDisabled(keeperCard.getByTestId("enhance-item"), "Enhance during the Forge build");
  await expectText(keeperCard.getByTestId("enhance-reason"), "Cần Lò Rèn cấp 2");

  // --- 6. Hourglasses finish the build; only as many as needed are spent. ---------------------
  await openTab(page, "Hội Quán");
  const neededHourglasses = Math.ceil(FORGE_L1_UPGRADE.seconds / HOURGLASS_SECONDS);
  await expectContains(page.getByTestId("speed-up-owned"), `×${SEEDED_HOURGLASSES}`);
  const speedUpAll = page.getByTestId("speed-up-all");
  await expectContains(speedUpAll, `(×${neededHourglasses})`);

  const speedUp = await runCommand(page, speedUpAll);
  const spedUp = speedUp.events.find((event) => event.type === "construction_sped_up");
  if (!spedUp) throw new Error(`Speed-up did not happen: ${JSON.stringify(speedUp)}`);
  assertEqual(
    {
      building: spedUp.building,
      materialId: spedUp.materialId,
      itemsUsed: spedUp.itemsUsed,
      completed: spedUp.completed,
      forgeLevel: speedUp.patch.forgeLevel,
      construction: speedUp.patch.construction,
    },
    {
      building: "forge",
      materialId: HOURGLASS,
      itemsUsed: neededHourglasses,
      completed: true,
      forgeLevel: 2,
      construction: null,
    },
    "speed-up result",
  );
  await expectText(forgeLevel, "2");
  await expectText(page.getByTestId("forge-enhance-cap"), "+2");
  await page.getByTestId("builder-idle").waitFor({ state: "visible", timeout: 10_000 });
  const hourglassesLeft = SEEDED_HOURGLASSES - neededHourglasses;
  assertEqual(await materialQty(page, HOURGLASS), hourglassesLeft, "hourglasses after speed-up");

  // --- 7. Forge level 2: better odds, enhancement unlocked, dust from dismantling. ------------
  await openTab(page, "Rèn");
  await expectText(page.getByTestId("forge-tab-level"), "2");
  await expectText(page.getByTestId("forge-tab-enhance-cap"), "+2");
  await expectContains(page.getByTestId("craft-odds"), COMMON_ODDS.forge2);
  const dustBalance = page.getByTestId("forge-dust-balance");
  await expectText(dustBalance, "×0");
  // The Forge no longer blocks the enhancement; the missing dust does.
  await expectText(
    keeperCard.getByTestId("enhance-reason"),
    `Chưa đủ Bụi Rèn (0/${ENHANCE_FROM_0.dust})`,
  );
  await expectDisabled(keeperCard.getByTestId("enhance-item"), "Enhance without Forge Dust");

  const expectedDust = DISMANTLE_DUST_BY_QUALITY[scrap.qualityBps];
  if (expectedDust === undefined) {
    throw new Error(`Crafted item has an unknown quality: ${scrap.qualityBps}`);
  }
  const dismantleButton = scrapCard.getByTestId("dismantle-item");
  await expectText(dismantleButton, `Phân rã (+${expectedDust} Bụi Rèn)`);
  const dismantle = await runCommand(page, dismantleButton);
  assertEqual(
    dismantle.events,
    [
      {
        type: "item_dismantled",
        itemInstanceId: scrap.id,
        materialId: FORGE_DUST,
        dust: expectedDust,
      },
    ],
    "dismantle result",
  );
  await scrapCard.waitFor({ state: "detached", timeout: 10_000 });
  await expectText(dustBalance, `×${expectedDust}`);

  await expectContains(
    keeperCard.getByTestId("enhance-cost"),
    `${ENHANCE_FROM_0.gold} vàng · ${ENHANCE_FROM_0.dust} Bụi Rèn · 100%`,
  );
  const enhance = await runCommand(page, keeperCard.getByTestId("enhance-item"));
  const enhanced = enhance.events.find((event) => event.type === "item_enhanced");
  if (!enhanced) throw new Error(`Enhance did not happen: ${JSON.stringify(enhance)}`);
  assertEqual(
    {
      success: enhanced.success,
      targetLevel: enhanced.targetLevel,
      goldCost: enhanced.goldCost,
      dustCost: enhanced.dustCost,
      enhanceLevel: (enhanced.item as InventoryItem).enhanceLevel,
    },
    {
      // The first enhancement level always succeeds (100%).
      success: true,
      targetLevel: 1,
      goldCost: ENHANCE_FROM_0.gold,
      dustCost: ENHANCE_FROM_0.dust,
      enhanceLevel: 1,
    },
    "enhance result",
  );

  const finalGold = goldAfterForge - ENHANCE_FROM_0.gold;
  const finalDust = expectedDust - ENHANCE_FROM_0.dust;
  await expectText(page.getByTestId("forge-gold"), String(finalGold));
  await expectText(dustBalance, `×${finalDust}`);

  const stillSamePage = await page.evaluate(
    () => (window as unknown as { __buildingsE2E?: boolean }).__buildingsE2E === true,
  );
  if (!stillSamePage) throw new Error("The page reloaded during the flow");

  // --- 8. Everything persisted. --------------------------------------------------------------
  await page.reload({ waitUntil: "domcontentloaded" });
  const persisted = await waitForApp(page);
  assertEqual(
    {
      id: persisted.id,
      gold: persisted.gold,
      hallLevel: persisted.hallLevel,
      forgeLevel: persisted.forgeLevel,
      construction: persisted.construction,
    },
    { id: start.id, gold: finalGold, hallLevel: 2, forgeLevel: 2, construction: null },
    "persisted player state",
  );
  const { materials } = await getJson<{ materials: MaterialBalance[] }>(page, "/api/v1/materials");
  assertEqual(
    [...SEEDED_MATERIALS.map((entry) => entry.materialId), FORGE_DUST].map((materialId) => ({
      materialId,
      qty: qtyOf(materials, materialId),
    })),
    [
      { materialId: "bamboo_fiber", qty: 0 },
      { materialId: "river_stone", qty: 0 },
      { materialId: HOURGLASS, qty: hourglassesLeft },
      { materialId: FORGE_DUST, qty: finalDust },
    ],
    "persisted materials",
  );
  const { items } = await getJson<{ items: InventoryItem[] }>(page, "/api/v1/inventory");
  assertEqual(
    items.map((item) => ({ id: item.id, enhanceLevel: item.enhanceLevel })),
    [{ id: keeper.id, enhanceLevel: 1 }],
    "persisted inventory",
  );

  await openTab(page, "Hội Quán");
  await expectText(page.getByTestId("hall-level"), "2");
  await expectText(page.getByTestId("forge-level"), "2");
  await expectText(page.getByTestId("guild-gold"), String(finalGold));
  await page.getByTestId("builder-idle").waitFor({ state: "visible", timeout: 10_000 });
  await openTab(page, "Rèn");
  await expectText(page.getByTestId("forge-dust-balance"), `×${finalDust}`);
  await expectText(keeperCard.getByTestId("enhance-cost"), ENHANCE_FROM_1_TEXT);

  if (process.env.GUILDHALL_E2E_SCREENSHOT) {
    await page.screenshot({ path: process.env.GUILDHALL_E2E_SCREENSHOT, fullPage: true });
  }

  console.log(
    `Buildings E2E passed: Hall 1→2 for ${HALL_L1_UPGRADE.gold} gold (${
      resyncedSeconds === null
        ? "settled when the Guild tab re-read the buildings"
        : `countdown ran out from ${resyncedSeconds}s`
    }, no reload); second upgrade refused (BUILDER_BUSY); Forge 1→2 for ${
      FORGE_L1_UPGRADE.gold
    } gold + ${FORGE_L1_UPGRADE.qty} ${FORGE_L1_UPGRADE.materialId}, finished by ${neededHourglasses} of ${SEEDED_HOURGLASSES} hourglasses; enhancement locked before and unlocked after; dismantle paid ${expectedDust} dust (quality ${
      scrap.qualityBps
    }), +1 cost ${ENHANCE_FROM_0.gold} gold + ${ENHANCE_FROM_0.dust} dust; gold ${start.gold} → ${finalGold}, dust ${finalDust}; all persisted after reload.`,
  );
} finally {
  await browser.close();
  await pool.end();
}
