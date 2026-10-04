import { launchBrowser } from "./browser.ts";

const expected = {
  result: "win",
  turns: 8,
  hash: "c080875a",
};

// Battle formula v2 (docs/03 §3), see packages/game-core/src/goldens.ts.
const expectedV2 = {
  result: "win",
  turns: 26,
  hash: "fce81aeb",
};

const url =
  process.env.BATTLE_GOLDEN_URL ??
  "http://127.0.0.1:5174/browser-golden.html";

const browser = await launchBrowser();

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page
    .locator("#result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    () => document.querySelector("#result")?.textContent !== "pending",
    undefined,
    { timeout: 10_000 },
  );

  const raw = await page.locator("#result").textContent();
  if (!raw || raw === "pending") {
    throw new Error("Browser golden page did not produce a result");
  }

  const actual = JSON.parse(raw) as {
    result: string;
    turns: number;
    hash: string;
  };

  if (
    actual.result !== expected.result ||
    actual.turns !== expected.turns ||
    actual.hash !== expected.hash
  ) {
    throw new Error(
      `Chromium golden mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }

  await page.waitForFunction(
    () => document.querySelector("#result-v2")?.textContent !== "pending",
    undefined,
    { timeout: 10_000 },
  );
  const rawV2 = await page.locator("#result-v2").textContent();
  const actualV2 = JSON.parse(rawV2 ?? "{}") as typeof expectedV2;
  if (
    actualV2.result !== expectedV2.result ||
    actualV2.turns !== expectedV2.turns ||
    actualV2.hash !== expectedV2.hash
  ) {
    throw new Error(
      `Chromium v2 golden mismatch: expected ${JSON.stringify(expectedV2)}, got ${JSON.stringify(actualV2)}`,
    );
  }

  console.log(
    `Chromium battle golden passed: v1 ${actual.result}, ${actual.turns} turns, ${actual.hash}; v2 ${actualV2.result}, ${actualV2.turns} turns, ${actualV2.hash}`,
  );
} finally {
  await browser.close();
}
