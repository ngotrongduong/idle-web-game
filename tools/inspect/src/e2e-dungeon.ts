import { Pool } from "pg";
import { type Page } from "playwright";
import { launchBrowser } from "./browser.ts";

const url = process.env.GUILDHALL_E2E_URL ?? "http://127.0.0.1:5173";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for dungeon E2E reward verification");
}

function referenceT1Progress(level: number, exp: number, gainedExp: number) {
  const cap = 10;
  if (level >= cap) return { level: cap, exp: 0 };

  let nextLevel = level;
  let nextExp = exp + gainedExp;

  while (nextLevel < cap) {
    const required = Math.round(20 + 18 * nextLevel ** 1.7);
    if (nextExp < required) break;

    nextExp -= required;
    nextLevel += 1;

    if (nextLevel === cap) {
      nextExp = 0;
      break;
    }
  }

  return { level: nextLevel, exp: nextExp };
}

async function runCommand(
  page: Page,
  button: ReturnType<Page["getByRole"]>,
): Promise<void> {
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
}

const browser = await launchBrowser();

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const refresh = page.getByRole("button", { name: "Làm mới", exact: true });
  await refresh.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll("button")].find(
        (entry) => entry.textContent?.trim() === "Làm mới",
      );
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    undefined,
    { timeout: 15_000 },
  );
  await runCommand(page, refresh);

  for (let index = 0; index < 3; index += 1) {
    const recruit = page
      .getByRole("button", { name: "Tuyển", exact: true })
      .first();
    await recruit.waitFor({ state: "visible", timeout: 10_000 });
    await runCommand(page, recruit);
  }

  await page
    .getByRole("button", { name: "Đội & Hầm", exact: true })
    .click();

  const firstTeam = page.locator(".team-card").first();
  await firstTeam.waitFor({ state: "visible", timeout: 10_000 });

  const heroChoices = firstTeam.locator('input[type="checkbox"]');
  const choiceCount = await heroChoices.count();
  if (choiceCount < 3) {
    throw new Error(`Expected at least 3 recruited heroes, got ${choiceCount}`);
  }

  for (let index = 0; index < 3; index += 1) {
    await heroChoices.nth(index).check();
  }

  await runCommand(
    page,
    firstTeam.getByRole("button", { name: "Lưu đội", exact: true }),
  );

  const refreshedFirstTeam = page.locator(".team-card").first();
  await runCommand(
    page,
    refreshedFirstTeam.getByRole("button", {
      name: "Bắt đầu",
      exact: true,
    }),
  );

  const replayBadge = refreshedFirstTeam.getByText(
    "Replay client đã khớp server",
    { exact: true },
  );
  await replayBadge.waitFor({ state: "visible", timeout: 15_000 });

  // A cycle stops at its first lost wave, so the persisted replay has 1–6 waves.
  const waves = refreshedFirstTeam.locator(".wave-card");
  const waveCount = await waves.count();
  if (waveCount < 1 || waveCount > 6) {
    throw new Error(`Expected 1–6 persisted waves, got ${waveCount}`);
  }

  const matchingHashes = refreshedFirstTeam.getByText("Hash client ✓", {
    exact: true,
  });
  const matchingCount = await matchingHashes.count();
  if (matchingCount !== waveCount) {
    throw new Error(
      `Expected ${waveCount} matching replay hashes, got ${matchingCount}`,
    );
  }

  const beforeClaim = await page.evaluate(async () => {
    const [stateResponse, heroesResponse, runsResponse] = await Promise.all([
      fetch("/api/v1/state", { credentials: "include" }),
      fetch("/api/v1/heroes", { credentials: "include" }),
      fetch("/api/v1/dungeon-runs", { credentials: "include" }),
    ]);
    return {
      state: await stateResponse.json(),
      heroes: await heroesResponse.json(),
      runs: await runsResponse.json(),
    };
  });

  const beforeRuns = (
    beforeClaim.runs as {
      runs: Array<{
        id: string;
        status: string;
        waves: Array<{ rewardGold: number; rewardExp: number }>;
        cycleSamples: Array<{ gold: number; exp: number }>;
      }>;
    }
  ).runs;
  const activeRun = beforeRuns.find((run) => run.status === "active");
  if (!activeRun) {
    throw new Error("Expected one active dungeon run before idle catch-up");
  }

  // Idle cycle c pays sample c % N (docs/04 §6); sample 0 is the persisted replay.
  const expectedCycles = 168;
  const samples = activeRun.cycleSamples;
  if (!samples || samples.length !== 30) {
    throw new Error(`Expected 30 sampled cycles, got ${samples?.length}`);
  }
  const replayGold = activeRun.waves.reduce((sum, wave) => sum + wave.rewardGold, 0);
  if (samples[0]!.gold !== replayGold) {
    throw new Error(`Sample 0 gold ${samples[0]!.gold} does not match its replay ${replayGold}`);
  }
  let expectedPendingGold = 0;
  let expectedExp = 0;
  for (let cycle = 0; cycle < expectedCycles; cycle += 1) {
    expectedPendingGold += samples[cycle % samples.length]!.gold;
    expectedExp += samples[cycle % samples.length]!.exp;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      "UPDATE dungeon_runs SET last_accrued_at = now() - interval '3 hours' WHERE id = $1",
      [activeRun.id],
    );
  } finally {
    await pool.end();
  }

  const accrued = await page.evaluate(async () => {
    const response = await fetch("/api/v1/dungeon-runs", {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Failed to accrue dungeon rewards: ${response.status}`);
    }
    return response.json();
  });

  const accruedRun = (
    accrued as {
      runs: Array<{
        id: string;
        pendingCycles: number;
        pendingGold: number;
        pendingExpPerHero: number;
      }>;
    }
  ).runs.find((run) => run.id === activeRun.id);

  if (!accruedRun) {
    throw new Error("Accrued dungeon run was not returned");
  }
  if (accruedRun.pendingCycles !== expectedCycles) {
    throw new Error(
      `Expected ${expectedCycles} cycles after 3h catch-up, got ${accruedRun.pendingCycles}`,
    );
  }
  if (accruedRun.pendingGold !== expectedPendingGold) {
    throw new Error(`Expected pending gold ${expectedPendingGold}, got ${accruedRun.pendingGold}`);
  }
  if (accruedRun.pendingExpPerHero !== expectedExp) {
    throw new Error(`Expected pending EXP/hero ${expectedExp}, got ${accruedRun.pendingExpPerHero}`);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Đội & Hầm", exact: true }).click();

  const claimTeam = page.locator(".team-card").first();
  const claimButton = claimTeam.getByRole("button", {
    name: "Nhận thưởng",
    exact: true,
  });
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll("button")].find(
        (entry) => entry.textContent?.trim() === "Nhận thưởng",
      );
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    undefined,
    { timeout: 10_000 },
  );

  await runCommand(page, claimButton);

  const afterClaim = await page.evaluate(async () => {
    const [stateResponse, heroesResponse] = await Promise.all([
      fetch("/api/v1/state", { credentials: "include" }),
      fetch("/api/v1/heroes", { credentials: "include" }),
    ]);
    return {
      state: await stateResponse.json(),
      heroes: await heroesResponse.json(),
    };
  });

  const beforeGold = (beforeClaim.state as { gold: number }).gold;
  const afterGold = (afterClaim.state as { gold: number }).gold;
  const expectedGold = beforeGold + accruedRun.pendingGold;
  if (afterGold !== expectedGold) {
    throw new Error(`Expected gold ${expectedGold} after claim, got ${afterGold}`);
  }

  const beforeHeroes = (
    beforeClaim.heroes as { heroes: Array<{ id: string; level: number; exp: number }> }
  ).heroes;
  const afterHeroes = (
    afterClaim.heroes as { heroes: Array<{ id: string; level: number; exp: number }> }
  ).heroes;
  for (const beforeHero of beforeHeroes) {
    const afterHero = afterHeroes.find((hero) => hero.id === beforeHero.id);
    const expected = referenceT1Progress(
      beforeHero.level,
      beforeHero.exp,
      accruedRun.pendingExpPerHero,
    );
    if (
      !afterHero ||
      afterHero.level !== expected.level ||
      afterHero.exp !== expected.exp
    ) {
      throw new Error(
        `Expected hero ${beforeHero.id} Lv.${expected.level} EXP ${expected.exp} after claim, got Lv.${afterHero?.level} EXP ${afterHero?.exp}`,
      );
    }
  }

  await claimTeam.getByText("0 cycle", { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });

  console.log(
    `Dungeon E2E passed: ${waveCount}/${waveCount} replay hashes matched; +3h catch-up produced exactly ${expectedCycles} cycles, ${accruedRun.pendingGold} gold and ${accruedRun.pendingExpPerHero} EXP/hero; claim reset pending rewards.`,
  );
} finally {
  await browser.close();
}
