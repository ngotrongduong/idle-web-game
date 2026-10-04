import { chromium, type Page } from "playwright";

const url = process.env.GUILDHALL_E2E_URL ?? "http://127.0.0.1:5173";

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

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

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

  const waves = refreshedFirstTeam.locator(".wave-card");
  const waveCount = await waves.count();
  if (waveCount !== 6) {
    throw new Error(`Expected 6 persisted waves, got ${waveCount}`);
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

  console.log(
    `Dungeon E2E passed: recruited 3 heroes, saved team 1, started 6-wave run, verified ${matchingCount}/${waveCount} client hashes.`,
  );
} finally {
  await browser.close();
}
