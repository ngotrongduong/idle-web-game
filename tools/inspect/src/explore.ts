/**
 * Điều khiển một phiên trình duyệt "bền" (persistent profile) để khám phá game từng bước:
 * mỗi lần chạy thực hiện một chuỗi lệnh, rồi chụp screenshot + ghi text hiển thị + danh sách
 * phần tử có thể bấm, và log mọi lời gọi API (body response lưu vào raw/, đã gitignore).
 *
 * Lệnh (mỗi lệnh là một tham số `--do`):
 *   goto:<url>  click:<text>  clickn:<text>|<n>  tap:<x>,<y>  fill:<placeholder>=<value>
 *   wait:<ms>   key:<Key>     scroll:<dy>        shot:<name>   fullshot:<name>   text:<name>
 *
 * Ví dụ:
 *   pnpm explore --profile research/fworldgm/raw/profile --do "goto:https://fworldgm.com/" --do "click:Register" --do shot:register
 */
import { chromium, type Page } from 'playwright';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { redactBody, redactUrl } from './lib/redact.ts';
import { REPO_ROOT, argList, argString, parseArgs } from './lib/util.ts';

async function listClickables(page: Page) {
  return page.evaluate(() => {
    const out: { text: string; x: number; y: number }[] = [];
    const nodes = document.querySelectorAll('[role="button"],button,a,[tabindex="0"],input,[role="tab"],[role="link"]');
    for (const el of nodes) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const text = ((el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      out.push({ text: text.slice(0, 60), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
    }
    return out;
  });
}

const args = parseArgs();
const slug = argString(args, 'slug', 'fworldgm')!;
const base = join(REPO_ROOT, 'research', slug);
const profile = resolve(argString(args, 'profile', join(base, 'raw', 'profile'))!);
const shotsDir = resolve(argString(args, 'shots', join(base, 'screenshots', 'walkthrough'))!);
const logDir = join(base, 'raw', 'explore');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(logDir, { recursive: true });
const mobile = args.mobile === true;
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;

const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  ...(proxyServer ? { proxy: { server: proxyServer, bypass: 'localhost,127.0.0.1,::1' } } : {}),
});
const page = context.pages()[0] ?? (await context.newPage());
const apiLog = join(logDir, 'api.jsonl');
page.on('response', async (res) => {
  const url = res.url();
  if (!/api\.php|socket\./.test(url)) return;
  let body = '';
  try {
    body = await res.text();
  } catch {
    /* body không đọc được */
  }
  const action = new URL(url).searchParams.get('action');
  appendFileSync(apiLog, JSON.stringify({ t: new Date().toISOString(), action, url: redactUrl(url), status: res.status(), request: redactBody(res.request().postData() ?? ''), bytes: body.length, body: redactBody(body).slice(0, 300_000) }) + '\n');
});

if (!page.url().startsWith('http')) await page.goto(argString(args, 'url', 'https://fworldgm.com/')!, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

for (const cmd of argList(args, 'do')) {
  const [op, ...rest] = cmd.split(':');
  const arg = rest.join(':');
  try {
    if (op === 'goto') await page.goto(arg, { waitUntil: 'domcontentloaded' });
    else if (op === 'click') await page.getByText(arg, { exact: true }).first().click({ timeout: 8000 });
    else if (op === 'clickc') await page.getByText(arg).first().click({ timeout: 8000 });
    else if (op === 'clickn') {
      const [text, n] = arg.split('|');
      await page.getByText(text!, { exact: true }).nth(Number(n)).click({ timeout: 8000 });
    } else if (op === 'tap') {
      const [x, y] = arg.split(',').map(Number);
      await page.mouse.click(x!, y!);
    } else if (op === 'fill') {
      const [ph, ...v] = arg.split('=');
      await page.getByPlaceholder(ph!).first().fill(v.join('='));
    } else if (op === 'wait') await page.waitForTimeout(Number(arg));
    else if (op === 'key') await page.keyboard.press(arg);
    else if (op === 'scroll') {
      await page.mouse.move(640, 400);
      await page.mouse.wheel(0, Number(arg));
    } else if (op === 'shot') await page.screenshot({ path: join(shotsDir, `${arg}.jpg`), type: 'jpeg', quality: 70 });
    else if (op === 'fullshot') await page.screenshot({ path: join(shotsDir, `${arg}.jpg`), type: 'jpeg', quality: 60, fullPage: true });
    else if (op === 'text') writeFileSync(join(logDir, `text-${arg}.txt`), await page.evaluate(() => document.body.innerText));
    await page.waitForTimeout(['wait', 'shot', 'fullshot', 'text'].includes(op!) ? 0 : 1200);
  } catch (err) {
    console.log(`! ${cmd}: ${String(err).split('\n')[0]}`);
  }
}

const text = await page.evaluate(() => document.body.innerText);
writeFileSync(join(logDir, 'last-text.txt'), text);
const clickables = await listClickables(page);
console.log('URL:', page.url());
console.log('--- TEXT ---\n' + text.slice(0, Number(argString(args, 'chars', '2500'))));
if (args.clicks === true) console.log('--- CLICKABLE ---\n' + clickables.map((c) => `${c.text} @${c.x},${c.y}`).join('\n'));
if (!existsSync(join(shotsDir))) mkdirSync(shotsDir, { recursive: true });
await page.screenshot({ path: join(logDir, 'last.jpg'), type: 'jpeg', quality: 70 });
await context.close();
