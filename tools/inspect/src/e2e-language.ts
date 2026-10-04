import { Pool } from "pg";
import { type Locator, type Page } from "playwright";
import { launchBrowser } from "./browser.ts";

const url = process.env.GUILDHALL_E2E_URL ?? "http://127.0.0.1:5173";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for language E2E setup");
}

// The expected texts are restated here instead of being read from @idle/i18n, so a wrong or
// missing string in the dictionary fails this script.
type Tab = "guild" | "dungeon" | "forge" | "tavern" | "more";
const TABS: Tab[] = ["guild", "dungeon", "forge", "tavern", "more"];

const VI = {
  tabs: { guild: "Hội Quán", dungeon: "Đội & Hầm", forge: "Rèn", tavern: "Tuyển Mộ", more: "Thêm" },
  refresh: "Làm mới",
  recruit: "Tuyển",
  saveTeam: "Lưu đội",
  start: "Bắt đầu",
  claim: "Nhận thưởng",
  craft: "Chế tạo",
  claimNotice: "Vừa nhận",
  cooldown: "Chưa đến lúc làm mới miễn phí. Hãy quay lại sau.",
  constructionNote: "Đang nâng cấp: Lò Rèn → Cấp 2 · Còn lại",
  more: "Màn này sẽ được nối vào core loop ở milestone tiếp theo.",
};
const EN = {
  tabs: {
    guild: "Guildhall",
    dungeon: "Teams & Dungeons",
    forge: "Forge",
    tavern: "Tavern",
    more: "More",
  },
  refresh: "Refresh",
  recruit: "Recruit",
  saveTeam: "Save team",
  start: "Start",
  claim: "Claim",
  craft: "Craft",
  claimNotice: "Just claimed",
  cooldown: "The free refresh is not ready yet. Come back later.",
  constructionNote: "Upgrading: Forge → Level 2 · Time left",
  more: "This screen will join the core loop in the next milestone.",
};
type Copy = typeof VI;

/** What the server says in English for the same error; it must never reach the screen. */
const SERVER_COOLDOWN_MESSAGE = "Next free tavern refresh is available at";
const LOCALE_KEY = "guildhall.locale";
const NARROW_VIEWPORT = { width: 360, height: 740 };

// packages/game-data/data/items.csv, materials.csv, buildings.json
const ITEM_ID = "bamboo_training_sword";
const SEEDED_MATERIALS = [
  { materialId: "bamboo_fiber", qty: 3 },
  { materialId: "river_stone", qty: 1 },
  { materialId: "builders_hourglass", qty: 2 },
];
const BUILD_MINUTES_LEFT = 90;

const VIETNAMESE_LOWER =
  "àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ";
const VIETNAMESE_LETTERS = new RegExp(`[${VIETNAMESE_LOWER}${VIETNAMESE_LOWER.toUpperCase()}]`);
const SNAKE_CASE_ID = /\b[a-z]+(?:_[a-z0-9]+)+\b/;
/** Words that used to be hardcoded English in the Vietnamese screens. */
const ENGLISH_LEFTOVERS_IN_VIETNAMESE = /\b(gold|turns?|ATK|DEF)\b/;

type PlayerState = { id: string; version: number; gold: number };
type CommandBody = { ok: true; events: Array<{ type: string } & Record<string, unknown>> };
type ErrorBody = { ok: false; code: string; message: string };
type CatalogBody = Record<"classes" | "dungeons" | "materials" | "items", Array<{ id: string }>>;
type DungeonRun = { id: string; status: "active" | "stopped" };

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** Polls until `done(read())` holds; the app re-renders after its own fetches, so never a sleep. */
async function eventually<T>(
  page: Page,
  read: () => Promise<T>,
  done: (value: T) => boolean,
  label: string,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) {
      throw new Error(`${label}: gave up waiting, last value ${JSON.stringify(value)}`);
    }
    await page.waitForTimeout(100);
  }
}

async function textNow(locator: Locator): Promise<string | undefined> {
  return (await locator.textContent({ timeout: 500 }).catch(() => null))?.trim();
}

async function expectText(locator: Locator, expected: string, label: string): Promise<void> {
  await eventually(
    locator.page(),
    () => textNow(locator),
    (actual) => actual === expected,
    label,
  );
}

async function expectContains(locator: Locator, part: string, label: string): Promise<void> {
  await eventually(
    locator.page(),
    () => textNow(locator),
    (actual) => actual?.includes(part) ?? false,
    label,
  );
}

async function getJson<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { credentials: "include" });
    if (!response.ok) throw new Error(`GET ${target} failed with ${response.status}`);
    return response.json();
  }, path) as Promise<T>;
}

/** Waits until the control is usable (the UI disables it while it reloads), then clicks it. */
async function runCommand(page: Page, button: Locator): Promise<CommandBody> {
  await button.waitFor({ state: "visible", timeout: 15_000 });
  await eventually(page, () => button.isEnabled(), Boolean, "button enabled", 15_000);
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

function tabButton(page: Page, copy: Copy, tab: Tab): Locator {
  return page.getByRole("button", { name: copy.tabs[tab], exact: true });
}

function localeButton(page: Page, locale: "vi" | "en"): Locator {
  const name = locale === "vi" ? "Tiếng Việt" : "English";
  return page.getByTestId("locale-switch").getByRole("button", { name, exact: true });
}

/**
 * The app has bootstrapped once the Tavern's refresh button is usable: it shows "working" and is
 * disabled until the player, catalog and collections are loaded.
 */
async function waitForApp(page: Page, copy: Copy): Promise<PlayerState> {
  const refresh = page.getByRole("button", { name: copy.refresh, exact: true });
  await refresh.waitFor({ state: "visible", timeout: 15_000 });
  await eventually(page, () => refresh.isEnabled(), Boolean, "refresh enabled", 15_000);
  return getJson<PlayerState>(page, "/api/v1/state");
}

async function htmlLang(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.lang);
}

async function storedLocale(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), LOCALE_KEY);
}

/** The page is in `locale`: html lang, the switch, and the tab names all agree. */
async function expectLocale(
  page: Page,
  locale: "vi" | "en",
  copy: Copy,
  label: string,
): Promise<void> {
  await eventually(page, () => htmlLang(page), (lang) => lang === locale, `${label}: html lang`);
  for (const option of ["vi", "en"] as const) {
    await eventually(
      page,
      () => localeButton(page, option).getAttribute("aria-pressed"),
      (pressed) => pressed === (option === locale ? "true" : "false"),
      `${label}: aria-pressed of ${option}`,
    );
  }
  for (const tab of TABS) {
    await tabButton(page, copy, tab).waitFor({ state: "visible", timeout: 10_000 });
  }
}

/** `expectLocale`, and the choice is also what a reload would restore. */
async function expectChosenLocale(
  page: Page,
  locale: "vi" | "en",
  copy: Copy,
  label: string,
): Promise<void> {
  await expectLocale(page, locale, copy, label);
  assertEqual(await storedLocale(page), locale, `${label}: saved language`);
}

/** Seconds in the trailing "m:ss" or "h:mm:ss" of a countdown line. */
function clockSeconds(text: string): number {
  const match = /(\d+(?::\d{2}){1,2})\s*$/.exec(text);
  if (!match) throw new Error(`No countdown at the end of "${text}"`);
  return match[1]!.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

type Surface = { text: string; attributes: string[] };

/** All text of the page, and every aria-label/title/alt, except the "Tiếng Việt" option itself. */
async function readSurface(page: Page): Promise<Surface> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelector('[data-testid="locale-vi"]')?.remove();
    const attributes: string[] = [];
    for (const element of clone.querySelectorAll("[aria-label],[title],[placeholder],[alt]")) {
      for (const name of ["aria-label", "title", "placeholder", "alt"]) {
        const value = element.getAttribute(name);
        if (value) attributes.push(value);
      }
    }
    return { text: clone.textContent ?? "", attributes };
  });
}

let knownIds: string[] = [];

function surfaceProblems(surface: Surface): string[] {
  const everything = [surface.text, ...surface.attributes].join("\n");
  const problems: string[] = [];
  const snake = SNAKE_CASE_ID.exec(everything);
  if (snake) problems.push(`raw id-like text "${snake[0]}"`);
  for (const id of knownIds) {
    if (new RegExp(`\\b${id}\\b`).test(everything)) problems.push(`legacy id "${id}" on screen`);
  }
  if (everything.includes(SERVER_COOLDOWN_MESSAGE)) problems.push("the server's English message");
  return problems;
}

async function expectNoBrokenLayout(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 0) {
    const culprits = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      // The deepest elements that stick out are the cause; their ancestors only follow them.
      return [...document.body.querySelectorAll("*")]
        .filter(
          (element) =>
            element.getBoundingClientRect().right > width + 0.5 &&
            ![...element.children].some((child) => child.getBoundingClientRect().right > width + 0.5),
        )
        .slice(0, 4)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return `${element.tagName.toLowerCase()}.${element.className} right=${Math.round(box.right)} width=${Math.round(box.width)}`;
        })
        .concat(
          // Elements whose own content is wider than they are squeeze the layout from inside.
          [...document.body.querySelectorAll("*")]
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .slice(0, 4)
            .map(
              (element) =>
                `${element.tagName.toLowerCase()}.${element.className} content=${element.scrollWidth} box=${element.clientWidth}`,
            ),
        );
    });
    throw new Error(
      `${label}: the page is ${overflow}px wider than the screen; reaching past it: ${culprits.join(", ")}`,
    );
  }
  const box = await page.getByTestId("locale-switch").boundingBox();
  if (!box || box.x < 0 || box.x + box.width > NARROW_VIEWPORT.width) {
    throw new Error(`${label}: language switch is not fully visible: ${JSON.stringify(box)}`);
  }
}

/** The element every tab renders, independent of the language, to know the tab has drawn. */
function tabReadyMarker(page: Page, tab: Tab): Locator {
  switch (tab) {
    case "guild":
      return page.getByTestId("builder-card");
    case "dungeon":
      return page.locator(".team-card").first();
    case "forge":
      return page.getByTestId("forge-summary");
    case "tavern":
      return page.locator(".tavern-header");
    case "more":
      return page.locator(".empty-state");
  }
}

const screenshotBase = process.env.GUILDHALL_E2E_SCREENSHOT?.replace(/\.png$/, "");

/** Opens every tab and checks that its text is in `locale` only. */
async function visitEveryTab(page: Page, locale: "vi" | "en", copy: Copy): Promise<void> {
  for (const tab of TABS) {
    await tabButton(page, copy, tab).click();
    await tabReadyMarker(page, tab).waitFor({ state: "visible", timeout: 10_000 });
    const label = `${locale} ${tab} tab`;
    const surface = await readSurface(page);
    const problems = surfaceProblems(surface);
    const everything = [surface.text, ...surface.attributes].join("\n");
    if (locale === "en") {
      const letter = VIETNAMESE_LETTERS.exec(everything);
      if (letter) problems.push(`Vietnamese letter "${letter[0]}" in the English screen`);
    } else {
      const leftover = ENGLISH_LEFTOVERS_IN_VIETNAMESE.exec(everything);
      if (leftover) problems.push(`English word "${leftover[0]}" in the Vietnamese screen`);
    }
    if (problems.length > 0) throw new Error(`${label}: ${problems.join("; ")}`);
    await expectNoBrokenLayout(page, label);
    if (screenshotBase) {
      await page.screenshot({ path: `${screenshotBase}-${locale}-${tab}.png`, fullPage: true });
    }
  }
}

const pool = new Pool({ connectionString: databaseUrl });

async function seedPlayer(playerId: string): Promise<void> {
  for (const material of SEEDED_MATERIALS) {
    await pool.query(
      `INSERT INTO player_materials (player_id, material_id, qty)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, material_id)
       DO UPDATE SET qty = EXCLUDED.qty, updated_at = now()`,
      [playerId, material.materialId, material.qty],
    );
  }
  // A Forge upgrade that is long from done, so its countdown runs for the whole script.
  const now = Date.now();
  const construction = {
    building: "forge",
    targetLevel: 2,
    startedAt: new Date(now - 30_000).toISOString(),
    completesAt: new Date(now + BUILD_MINUTES_LEFT * 60_000).toISOString(),
  };
  const result = await pool.query("UPDATE players SET construction = $2::jsonb WHERE id = $1", [
    playerId,
    JSON.stringify(construction),
  ]);
  if (result.rowCount !== 1) throw new Error(`Player ${playerId} was not found for seeding`);
}

const browser = await launchBrowser();

try {
  // An English browser on a phone-sized screen: the language must still start as Vietnamese.
  const context = await browser.newContext({ viewport: NARROW_VIEWPORT, locale: "en-US" });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  const fresh = await waitForApp(page, VI);
  assertEqual(await page.evaluate(() => navigator.language), "en-US", "browser language");
  assertEqual(await htmlLang(page), "vi", "initial html lang");
  assertEqual(await storedLocale(page), null, "nothing saved before the first choice");
  for (const option of ["vi", "en"] as const) {
    assertEqual(
      await localeButton(page, option).getAttribute("lang"),
      option,
      `lang of the ${option} option`,
    );
  }
  assertEqual(
    await localeButton(page, "vi").getAttribute("aria-pressed"),
    "true",
    "Vietnamese is the selected language by default",
  );

  const catalog = await getJson<CatalogBody>(page, "/api/v1/catalog");
  knownIds = [...catalog.classes, ...catalog.dungeons, ...catalog.materials, ...catalog.items].map(
    (entry) => entry.id,
  );

  // --- 1. Set the player up in Vietnamese: heroes, a run with rewards, an item, a build. --------
  // Let the app create its guest first, then seed that player and reload so the page sees it.
  await seedPlayer(fresh.id);
  await page.reload({ waitUntil: "domcontentloaded" });
  const start = await waitForApp(page, VI);
  if (start.id !== fresh.id) {
    throw new Error(`Session switched players after reload: ${fresh.id} -> ${start.id}`);
  }

  // The Tavern refresh is on a two-hour cooldown. The page is told the cooldown is over (as it
  // would be on a phone whose clock runs ahead), so it offers a second refresh that the real
  // server then refuses with TAVERN_COOLDOWN.
  await page.route("**/api/v1/tavern", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { tavern?: { nextFreeRefreshAt: string } };
    if (body.tavern) body.tavern.nextFreeRefreshAt = new Date(0).toISOString();
    await route.fulfill({
      status: response.status(),
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await runCommand(page, page.getByRole("button", { name: VI.refresh, exact: true }));
  for (let index = 0; index < 2; index += 1) {
    await runCommand(
      page,
      page.getByRole("button", { name: VI.recruit, exact: true }).first(),
    );
  }
  await eventually(
    page,
    () => page.locator(".hero-roster-item").count(),
    (count) => count === 2,
    "two heroes on the roster",
  );

  await tabButton(page, VI, "dungeon").click();
  const firstTeam = page.locator(".team-card").first();
  await firstTeam.waitFor({ state: "visible", timeout: 10_000 });
  await eventually(
    page,
    () => firstTeam.locator('input[type="checkbox"]').count(),
    (count) => count === 2,
    "two heroes to pick",
  );
  await firstTeam.locator('input[type="checkbox"]').nth(0).check();
  await runCommand(page, firstTeam.getByRole("button", { name: VI.saveTeam, exact: true }));
  await runCommand(page, firstTeam.getByRole("button", { name: VI.start, exact: true }));
  await firstTeam
    .getByText("Replay client đã khớp server", { exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });

  // Two hours of idle rewards, found again when the Dungeon tab is re-entered, then claimed.
  const { runs } = await getJson<{ runs: DungeonRun[] }>(page, "/api/v1/dungeon-runs");
  const activeRun = runs.find((run) => run.status === "active");
  if (!activeRun) throw new Error("Expected an active dungeon run");
  await pool.query(
    "UPDATE dungeon_runs SET last_accrued_at = now() - interval '2 hours' WHERE id = $1",
    [activeRun.id],
  );
  await tabButton(page, VI, "tavern").click();
  await tabButton(page, VI, "dungeon").click();
  const claim = await runCommand(
    page,
    page.locator(".team-card").first().getByRole("button", { name: VI.claim, exact: true }),
  );
  if (!claim.events.some((event) => event.type === "dungeon_rewards_claimed")) {
    throw new Error(`Claim did not pay out: ${JSON.stringify(claim.events)}`);
  }
  const claimNotice = page.getByRole("status").filter({ hasText: VI.claimNotice });
  await claimNotice.waitFor({ state: "visible", timeout: 10_000 });

  await tabButton(page, VI, "forge").click();
  await runCommand(
    page,
    page
      .locator(`.craft-row[data-item-id="${ITEM_ID}"]`)
      .getByRole("button", { name: VI.craft, exact: true }),
  );
  await page.locator(".equipment-card").first().waitFor({ state: "visible", timeout: 10_000 });

  // --- 2. Leave something a reload would lose: an unsaved draft for team 2. --------------------
  await tabButton(page, VI, "dungeon").click();
  const secondTeamHeroes = page.locator(".team-card").nth(1).locator('input[type="checkbox"]');
  await secondTeamHeroes.nth(1).check();
  await claimNotice.waitFor({ state: "visible", timeout: 10_000 });
  await page.evaluate(() => {
    (window as unknown as { __languageE2E?: boolean }).__languageE2E = true;
  });
  await expectLocale(page, "vi", VI, "before switching");

  // Vietnamese is clean too: no leftover English words, no ids.
  await visitEveryTab(page, "vi", VI);

  // Back on the Forge tab: it shows the running build's countdown and an item, in Vietnamese.
  await tabButton(page, VI, "dungeon").click();
  await secondTeamHeroes.nth(1).waitFor({ state: "visible", timeout: 10_000 });
  if (!(await secondTeamHeroes.nth(1).isChecked())) {
    throw new Error("The unsaved team draft was lost by walking through the tabs");
  }
  await tabButton(page, VI, "forge").click();
  const note = page.getByTestId("construction-note");
  await expectContains(note, VI.constructionNote, "Vietnamese construction note");
  const secondsBefore = clockSeconds((await textNow(note)) ?? "");

  // --- 3. Switch to English from the keyboard, in place. --------------------------------------
  const apiRequests: string[] = [];
  let recording = false;
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (recording && pathname.startsWith("/api/")) {
      apiRequests.push(`${request.method()} ${pathname}`);
    }
  });
  recording = true;
  await localeButton(page, "en").focus();
  await page.keyboard.press("Enter");
  await expectChosenLocale(page, "en", EN, "after switching to English");
  // Two frames: whatever the switch would have fetched has been requested by then.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  recording = false;

  assertEqual(
    await page.evaluate(
      () => (window as unknown as { __languageE2E?: boolean }).__languageE2E === true,
    ),
    true,
    "the page was not reloaded by the language switch",
  );
  assertEqual(apiRequests, [], "requests made by the language switch");
  await tabReadyMarker(page, "forge").waitFor({ state: "visible", timeout: 5_000 });
  await expectContains(note, EN.constructionNote, "English construction note");
  await eventually(
    page,
    async () => clockSeconds((await textNow(note)) ?? ""),
    (seconds) => seconds < secondsBefore,
    "the build countdown keeps running after the switch",
  );
  assertEqual(
    (await page.locator(".tabs button.active").textContent())?.trim(),
    EN.tabs.forge,
    "the Forge tab stays open",
  );

  // The draft, the notice and the other tabs survived too.
  await tabButton(page, EN, "dungeon").click();
  await secondTeamHeroes.nth(1).waitFor({ state: "visible", timeout: 10_000 });
  if (!(await secondTeamHeroes.nth(1).isChecked())) {
    throw new Error("The unsaved team draft was lost by the language switch");
  }
  await page
    .getByRole("status")
    .filter({ hasText: EN.claimNotice })
    .waitFor({ state: "visible", timeout: 10_000 });
  assertEqual(
    await page
      .locator(".team-card")
      .nth(1)
      .getByRole("button", { name: EN.saveTeam, exact: true })
      .count(),
    1,
    "the unsaved team can be saved (button reads Save team, not Saved)",
  );

  // --- 4. Every tab is English only. ----------------------------------------------------------
  await visitEveryTab(page, "en", EN);

  // --- 5. A server error is explained in the current language, and follows the switch. -------
  await tabButton(page, EN, "tavern").click();
  const [cooldownResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/v1/cmd") && candidate.request().method() === "POST",
    ),
    page.getByRole("button", { name: EN.refresh, exact: true }).click(),
  ]);
  const cooldownBody = (await cooldownResponse.json()) as ErrorBody;
  assertEqual(
    { status: cooldownResponse.status(), code: cooldownBody.code },
    { status: 409, code: "TAVERN_COOLDOWN" },
    "the second Tavern refresh",
  );
  const alert = page.getByRole("alert");
  await expectText(alert, EN.cooldown, "English cooldown message");
  if ((await textNow(alert))?.includes(SERVER_COOLDOWN_MESSAGE)) {
    throw new Error("The server's English message was shown");
  }

  await localeButton(page, "vi").click();
  await expectChosenLocale(page, "vi", VI, "after switching back to Vietnamese");
  await expectText(alert, VI.cooldown, "the same error in Vietnamese");
  assertEqual(
    await page.evaluate(
      () => (window as unknown as { __languageE2E?: boolean }).__languageE2E === true,
    ),
    true,
    "the page was not reloaded by switching back",
  );

  // --- 6. The choice survives a reload. ------------------------------------------------------
  await localeButton(page, "en").click();
  await expectChosenLocale(page, "en", EN, "English again");
  await page.reload({ waitUntil: "domcontentloaded" });
  const reloaded = await waitForApp(page, EN);
  if (reloaded.id !== fresh.id) {
    throw new Error(`Session switched players after reload: ${fresh.id} -> ${reloaded.id}`);
  }
  await expectChosenLocale(page, "en", EN, "after reloading in English");
  await tabReadyMarker(page, "tavern").waitFor({ state: "visible", timeout: 10_000 });
  await visitEveryTab(page, "en", EN);

  await localeButton(page, "vi").click();
  await expectChosenLocale(page, "vi", VI, "Vietnamese after the reload");
  await visitEveryTab(page, "vi", VI);

  // An unknown saved value is ignored, not trusted.
  await page.evaluate((key) => window.localStorage.setItem(key, "fr"), LOCALE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page, VI);
  assertEqual(await htmlLang(page), "vi", "html lang with an unknown saved language");
  assertEqual(
    await localeButton(page, "vi").getAttribute("aria-pressed"),
    "true",
    "Vietnamese is selected when the saved language is unknown",
  );

  assertEqual(pageErrors, [], "uncaught errors in the page");

  console.log(
    `Language E2E passed: Vietnamese by default in an en-US browser at ${NARROW_VIEWPORT.width}px; switched to English from the keyboard without a reload, a request or losing the team draft, claim notice, Forge tab and running ${BUILD_MINUTES_LEFT}-minute countdown; all five tabs English-only (no Vietnamese letters, no ids) and Vietnamese without English leftovers; TAVERN_COOLDOWN explained in English, then in Vietnamese; the choice survived a reload and an unknown saved value fell back to Vietnamese.`,
  );
} finally {
  await browser.close();
  await pool.end();
}
