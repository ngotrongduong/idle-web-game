import { chromium, type LaunchOptions } from "playwright";

/**
 * CI installs Google Chrome and uses the "chrome" channel. Set GUILDHALL_BROWSER=chromium to run
 * against Playwright's bundled Chromium instead (e.g. in containers without Chrome).
 */
export function launchBrowser() {
  const options: LaunchOptions = { headless: true };
  if (process.env.GUILDHALL_BROWSER !== "chromium") {
    options.channel = "chrome";
  }
  return chromium.launch(options);
}
