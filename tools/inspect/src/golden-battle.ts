import { chromium } from "playwright";

const expected = {
  result: "win",
  turns: 8,
  hash: "c080875a",
};

const url =
  process.env.BATTLE_GOLDEN_URL ??
  "http://127.0.0.1:5174/browser-golden.html";

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });

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

  console.log(
    `Chromium battle golden passed: ${actual.result}, ${actual.turns} turns, ${actual.hash}`,
  );
} finally {
  await browser.close();
}
