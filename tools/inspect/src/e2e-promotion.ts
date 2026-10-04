import { Pool } from "pg";
import { type Locator, type Page } from "playwright";
import { launchBrowser } from "./browser.ts";

const url = process.env.GUILDHALL_E2E_URL ?? "http://127.0.0.1:5173";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to backdate idle dungeon runs");
}

// 8h offline cap × 75% efficiency / 48s cycles.
const EXPECTED_CAPPED_CYCLES = 450;
const T1_LEVEL_CAP = 10;
const T1_SEAL = "promotion_seal_t1";
const T1_PROMOTION_GOLD = 500;

type MaterialBalance = { materialId: string; qty: number };

type Hero = {
  id: string;
  classId: string;
  level: number;
  exp: number;
  potential?: { hp: number; attack: number; defense: number; speed: number };
};

type DungeonRun = {
  id: string;
  status: "active" | "stopped";
  pendingCycles: number;
  pendingMaterials: MaterialBalance[];
  waves: Array<{ result: string }>;
  cycleSamples: Array<{ kills: { boss: number } }> | null;
};

type ClaimEvent = {
  type: "dungeon_rewards_claimed";
  cycles: number;
  materials: MaterialBalance[];
};

type CommandBody = {
  ok: true;
  events: Array<{ type: string } & Record<string, unknown>>;
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
    if (!response.ok) {
      throw new Error(`GET ${target} failed with ${response.status}`);
    }
    return response.json();
  }, path) as Promise<T>;
}

async function activeRun(page: Page): Promise<DungeonRun> {
  const { runs } = await getJson<{ runs: DungeonRun[] }>(
    page,
    "/api/v1/dungeon-runs",
  );
  const run = runs.find((entry) => entry.status === "active");
  if (!run) throw new Error("Expected an active dungeon run");
  return run;
}

async function backdateRun(runId: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      "UPDATE dungeon_runs SET last_accrued_at = now() - interval '9 hours' WHERE id = $1",
      [runId],
    );
  } finally {
    await pool.end();
  }
}

async function openDungeonTab(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Đội & Hầm", exact: true }).click();
  const team = page.locator(".team-card").first();
  await team.waitFor({ state: "visible", timeout: 10_000 });
  return team;
}

/** Backdates the active run past the offline cap, then claims it through the UI. */
async function farmCappedCycles(page: Page): Promise<ClaimEvent> {
  const run = await activeRun(page);
  await backdateRun(run.id);

  const accrued = await activeRun(page);
  if (accrued.pendingCycles !== EXPECTED_CAPPED_CYCLES) {
    throw new Error(
      `Expected ${EXPECTED_CAPPED_CYCLES} capped cycles, got ${accrued.pendingCycles}`,
    );
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  const team = await openDungeonTab(page);
  const body = await runCommand(
    page,
    team.getByRole("button", { name: "Nhận thưởng", exact: true }),
  );
  const claim = body.events.find(
    (event): event is ClaimEvent => event.type === "dungeon_rewards_claimed",
  );
  if (!claim || claim.cycles !== EXPECTED_CAPPED_CYCLES) {
    throw new Error(`Unexpected claim result: ${JSON.stringify(body.events)}`);
  }
  expectSameMaterials(claim.materials, accrued.pendingMaterials, "claim");
  await page
    .getByRole("status")
    .filter({ hasText: "Vừa nhận" })
    .waitFor({ state: "visible", timeout: 10_000 });
  return claim;
}

function sumMaterials(...parts: MaterialBalance[][]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const part of parts) {
    for (const entry of part) {
      totals.set(entry.materialId, (totals.get(entry.materialId) ?? 0) + entry.qty);
    }
  }
  return totals;
}

function expectSameMaterials(
  actual: MaterialBalance[],
  expected: MaterialBalance[],
  label: string,
): void {
  const left = JSON.stringify([...sumMaterials(actual)].sort());
  const right = JSON.stringify([...sumMaterials(expected)].sort());
  if (left !== right) {
    throw new Error(`Material mismatch for ${label}: ${left} !== ${right}`);
  }
}

const browser = await launchBrowser();

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Tavern: refresh offers and recruit three heroes.
  await runCommand(
    page,
    page.getByRole("button", { name: "Làm mới", exact: true }),
  );
  for (let index = 0; index < 3; index += 1) {
    await runCommand(
      page,
      page.getByRole("button", { name: "Tuyển", exact: true }).first(),
    );
  }

  // Team + first run: level the fresh heroes to the T1 cap.
  let team = await openDungeonTab(page);
  const heroChoices = team.locator('input[type="checkbox"]');
  for (let index = 0; index < 3; index += 1) {
    await heroChoices.nth(index).check();
  }
  await runCommand(page, team.getByRole("button", { name: "Lưu đội", exact: true }));
  await runCommand(page, team.getByRole("button", { name: "Bắt đầu", exact: true }));

  const levelingClaim = await farmCappedCycles(page);
  const { heroes: cappedHeroes } = await getJson<{ heroes: Hero[] }>(
    page,
    "/api/v1/heroes",
  );
  if (cappedHeroes.some((hero) => hero.level !== T1_LEVEL_CAP)) {
    throw new Error(
      `Expected all heroes at Lv.${T1_LEVEL_CAP}, got ${cappedHeroes.map((hero) => hero.level).join(",")}`,
    );
  }

  // Restart so the run snapshots the capped heroes, then farm boss seals.
  team = await openDungeonTab(page);
  await runCommand(page, team.getByRole("button", { name: "Dừng", exact: true }));
  await runCommand(page, team.getByRole("button", { name: "Bắt đầu", exact: true }));
  const sealRun = await activeRun(page);
  if (!sealRun.cycleSamples?.some((sample) => sample.kills.boss > 0)) {
    throw new Error("Capped team did not defeat the boss in any sampled cycle");
  }

  const sealClaim = await farmCappedCycles(page);
  const { materials } = await getJson<{ materials: MaterialBalance[] }>(
    page,
    "/api/v1/materials",
  );
  expectSameMaterials(
    materials,
    [...sumMaterials(levelingClaim.materials, sealClaim.materials)].map(
      ([materialId, qty]) => ({ materialId, qty }),
    ),
    "inventory",
  );
  const sealsBefore =
    materials.find((entry) => entry.materialId === T1_SEAL)?.qty ?? 0;
  if (sealsBefore < 1) {
    throw new Error("Expected at least one T1 promotion seal from boss loot");
  }

  // Promotion is blocked while the hero is in an active run.
  team = await openDungeonTab(page);
  await runCommand(page, team.getByRole("button", { name: "Dừng", exact: true }));

  await page.getByRole("button", { name: "Tuyển Mộ", exact: true }).click();
  await page
    .locator('.inventory-list li[data-material-id="promotion_seal_t1"]')
    .waitFor({ state: "visible", timeout: 10_000 });

  const { gold: goldBefore } = await getJson<{ gold: number }>(
    page,
    "/api/v1/state",
  );
  const promoteButton = page
    .locator(".promotion-actions button")
    .filter({ hasText: "Thăng" })
    .first();
  const promoteLabel = (await promoteButton.textContent())?.trim() ?? "";
  const promoteBody = await runCommand(page, promoteButton);
  const promoted = promoteBody.events.find(
    (event) => event.type === "hero_promoted",
  ) as unknown as { hero: Hero; fromClassId: string; toClassId: string } | undefined;
  if (!promoted) {
    throw new Error(`Promotion did not emit hero_promoted: ${JSON.stringify(promoteBody)}`);
  }

  const [{ heroes: afterHeroes }, { materials: afterMaterials }, afterState, catalog] =
    await Promise.all([
      getJson<{ heroes: Hero[] }>(page, "/api/v1/heroes"),
      getJson<{ materials: MaterialBalance[] }>(page, "/api/v1/materials"),
      getJson<{ gold: number }>(page, "/api/v1/state"),
      getJson<{ classes: Array<{ id: string; nameVi: string }> }>(
        page,
        "/api/v1/catalog",
      ),
    ]);
  const hero = afterHeroes.find((entry) => entry.id === promoted.hero.id);
  const potential = hero?.potential;
  if (
    !hero ||
    hero.classId !== promoted.toClassId ||
    hero.level !== 1 ||
    hero.exp !== 0 ||
    !potential ||
    potential.hp <= 0 ||
    potential.attack <= 0
  ) {
    throw new Error(`Unexpected promoted hero: ${JSON.stringify(hero)}`);
  }
  const sealsAfter =
    afterMaterials.find((entry) => entry.materialId === T1_SEAL)?.qty ?? 0;
  if (sealsAfter !== sealsBefore - 1) {
    throw new Error(`Expected ${sealsBefore - 1} seals after promotion, got ${sealsAfter}`);
  }
  if (afterState.gold !== goldBefore - T1_PROMOTION_GOLD) {
    throw new Error(
      `Expected gold ${goldBefore - T1_PROMOTION_GOLD} after promotion, got ${afterState.gold}`,
    );
  }

  const newClassName = catalog.classes.find(
    (entry) => entry.id === promoted.toClassId,
  )?.nameVi;
  if (!newClassName || !promoteLabel.endsWith(newClassName)) {
    throw new Error(`Promote button "${promoteLabel}" did not name ${newClassName}`);
  }
  await page
    .locator(".roster li")
    .filter({ hasText: newClassName })
    .filter({ hasText: "T2" })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  if (process.env.GUILDHALL_E2E_SCREENSHOT) {
    await page.screenshot({ path: process.env.GUILDHALL_E2E_SCREENSHOT, fullPage: true });
  }

  console.log(
    `Promotion E2E passed: two capped claims (${EXPECTED_CAPPED_CYCLES} cycles each) leveled 3 heroes to Lv.${T1_LEVEL_CAP} and dropped ${sealsBefore} T1 seal(s); ${promoted.fromClassId} → ${promoted.toClassId} spent 1 seal + ${T1_PROMOTION_GOLD} gold and kept potential ${JSON.stringify(potential)}.`,
  );
} finally {
  await browser.close();
}
