/**
 * Capture thụ động một web game bằng Playwright:
 *  - HAR đầy đủ (kèm body) cho mỗi viewport
 *  - log request/response, request lỗi (phát hiện host bị proxy chặn)
 *  - toàn bộ frame WebSocket (gửi/nhận)
 *  - console + lỗi JS
 *  - screenshot theo mốc thời gian và theo từng bước (steps)
 *  - probe biến global / engine / meta / link trong mọi frame
 *  - static recon: robots.txt, sitemap.xml, manifest, security.txt
 *
 * Ví dụ:
 *   pnpm --filter @idle/inspect capture --url https://fworldgm.com/ --wait 45
 *   pnpm --filter @idle/inspect capture --url https://fworldgm.com/ --steps steps.json --storage-state state.json
 *
 * Nguyên tắc: chỉ quan sát như người chơi bình thường. Không fuzz, không load test, không dò endpoint admin.
 */
import { chromium, devices, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { browserProbe, type ProbeResult } from './lib/fingerprint.ts';
import { redactUrl } from './lib/redact.ts';
import {
  REPO_ROOT,
  JsonlWriter,
  argList,
  argNumber,
  argString,
  ensureDir,
  parseArgs,
  slugFromUrl,
  timestamp,
  writeJson,
} from './lib/util.ts';

export type Step =
  | { action: 'wait'; ms: number; viewport?: string }
  | { action: 'click'; selector: string; viewport?: string }
  | { action: 'clickAt'; x: number; y: number; viewport?: string }
  | { action: 'type'; selector: string; text: string; viewport?: string }
  | { action: 'press'; key: string; viewport?: string }
  | { action: 'goto'; url: string; viewport?: string }
  | { action: 'screenshot'; name: string; viewport?: string };

export interface CaptureOptions {
  url: string;
  /** Thư mục dữ liệu thô (HAR, log). Nên nằm trong raw/ (gitignored). */
  outDir: string;
  /** Thư mục screenshot (được commit). */
  shotsDir: string;
  /** Số giây quan sát thêm sau khi trang load. */
  waitSeconds: number;
  viewports: string[];
  steps: Step[];
  storageState?: string;
  headed?: boolean;
  /** Tắt static recon (robots/sitemap...). */
  skipStatic?: boolean;
}

export interface CaptureSummary {
  url: string;
  startedAt: string;
  finishedAt: string;
  outDir: string;
  viewports: Record<
    string,
    {
      har: string;
      requests: number;
      failedRequests: number;
      websockets: number;
      wsFrames: number;
      consoleMessages: number;
      pageErrors: number;
      screenshots: string[];
      frames: string[];
    }
  >;
  blockedHosts: string[];
  staticRecon: { path: string; status: number | null; bytes: number; file?: string }[];
}

const VIEWPORTS: Record<string, Parameters<Browser['newContext']>[0]> = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  mobile: { ...devices['iPhone 13'], locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
};

/** Lỗi mạng cho thấy host bị chặn bởi proxy/policy (không phải lỗi của game). */
const BLOCKED_ERRORS = /ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ERR_BLOCKED|ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|ERR_CERT/;

const INIT_SCRIPT = `
  // tsx/esbuild có thể chèn helper __name vào hàm được serialize sang trình duyệt.
  globalThis.__name = globalThis.__name || ((f) => f);
  // Ghi lại loại context của canvas (2d/webgl/webgl2) mà không tự tạo context mới.
  (() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      const ctx = orig.call(this, type, ...rest);
      if (ctx && !this.__ctx) this.__ctx = type;
      return ctx;
    };
  })();
`;

export async function runCapture(opts: CaptureOptions): Promise<CaptureSummary> {
  ensureDir(opts.outDir);
  ensureDir(opts.shotsDir);
  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    headless: !opts.headed,
    ...(proxyServer ? { proxy: { server: proxyServer, bypass: 'localhost,127.0.0.1,::1' } } : {}),
  });
  const summary: CaptureSummary = {
    url: opts.url,
    startedAt: new Date().toISOString(),
    finishedAt: '',
    outDir: opts.outDir,
    viewports: {},
    blockedHosts: [],
    staticRecon: [],
  };
  const blocked = new Set<string>();

  // Baseline global keys từ một trang trống, để lọc ra global "lạ" của game.
  const baselinePage = await browser.newPage();
  await baselinePage.addInitScript(INIT_SCRIPT);
  await baselinePage.setContent('<html><body></body></html>');
  const baselineKeys = await baselinePage.evaluate(() => Object.keys(window));
  baselineKeys.push('__name');
  await baselinePage.close();

  try {
    for (const vpName of opts.viewports) {
      const vp = VIEWPORTS[vpName];
      if (!vp) throw new Error(`Viewport không hỗ trợ: ${vpName} (chọn: ${Object.keys(VIEWPORTS).join(', ')})`);
      const vpDir = ensureDir(join(opts.outDir, vpName));
      const harPath = join(vpDir, 'capture.har');
      const context = await browser.newContext({
        ...vp,
        serviceWorkers: 'block', // để mọi request đều đi qua HAR
        recordHar: { path: harPath, content: 'embed', mode: 'full' },
        ...(opts.storageState ? { storageState: opts.storageState } : {}),
      });
      await context.addInitScript(INIT_SCRIPT);
      const stats = await captureViewport(context, vpName, vpDir, opts, baselineKeys, blocked);
      if (vpName === opts.viewports[0] && !opts.skipStatic) summary.staticRecon = await staticRecon(context, opts);
      await context.storageState({ path: join(vpDir, 'storage-state.json') });
      await context.close(); // HAR chỉ được ghi xong khi context đóng
      summary.viewports[vpName] = { har: harPath, ...stats };
    }
  } finally {
    await browser.close();
  }

  summary.blockedHosts = [...blocked].sort();
  summary.finishedAt = new Date().toISOString();
  writeJson(join(opts.outDir, 'summary.json'), summary);
  return summary;
}

async function captureViewport(
  context: BrowserContext,
  vpName: string,
  vpDir: string,
  opts: CaptureOptions,
  baselineKeys: string[],
  blocked: Set<string>,
) {
  const requests = new JsonlWriter(join(vpDir, 'requests.jsonl'));
  const ws = new JsonlWriter(join(vpDir, 'ws.jsonl'));
  const consoleLog = new JsonlWriter(join(vpDir, 'console.jsonl'));
  const t0 = Date.now();
  const stats = { requests: 0, failedRequests: 0, websockets: 0, wsFrames: 0, consoleMessages: 0, pageErrors: 0, screenshots: [] as string[], frames: [] as string[] };

  context.on('response', (response) => {
    const req = response.request();
    stats.requests++;
    const headers = response.headers();
    requests.write({
      t: Date.now() - t0,
      method: req.method(),
      url: redactUrl(req.url()),
      status: response.status(),
      resourceType: req.resourceType(),
      mime: headers['content-type'] ?? null,
      contentLength: headers['content-length'] ? Number(headers['content-length']) : null,
      server: headers['server'] ?? null,
      cache: headers['cache-control'] ?? null,
      cdn: headers['cf-cache-status'] ?? headers['x-cache'] ?? headers['x-cdn'] ?? null,
    });
  });
  context.on('requestfailed', (req) => {
    stats.failedRequests++;
    const errorText = req.failure()?.errorText ?? 'unknown';
    if (BLOCKED_ERRORS.test(errorText)) {
      try {
        blocked.add(new URL(req.url()).host);
      } catch {
        /* URL không hợp lệ */
      }
    }
    requests.write({ t: Date.now() - t0, method: req.method(), url: redactUrl(req.url()), failed: errorText, resourceType: req.resourceType() });
  });

  const attachPage = (page: Page) => {
    page.on('console', (msg) => {
      stats.consoleMessages++;
      consoleLog.write({ t: Date.now() - t0, kind: 'console', type: msg.type(), text: msg.text().slice(0, 2000), location: msg.location().url });
    });
    page.on('pageerror', (err) => {
      stats.pageErrors++;
      consoleLog.write({ t: Date.now() - t0, kind: 'pageerror', text: String(err?.stack ?? err).slice(0, 4000) });
    });
    page.on('websocket', (socket) => {
      stats.websockets++;
      const url = redactUrl(socket.url());
      ws.write({ t: Date.now() - t0, event: 'open', url });
      const onFrame = (direction: 'send' | 'receive') => (frame: { payload: string | Buffer }) => {
        stats.wsFrames++;
        const isBinary = typeof frame.payload !== 'string';
        const payload = isBinary ? (frame.payload as Buffer).toString('base64') : (frame.payload as string);
        ws.write({ t: Date.now() - t0, event: 'frame', url, direction, opcode: isBinary ? 2 : 1, length: isBinary ? (frame.payload as Buffer).length : payload.length, data: payload.slice(0, 200_000) });
      };
      socket.on('framesent', onFrame('send'));
      socket.on('framereceived', onFrame('receive'));
      socket.on('socketerror', (error) => ws.write({ t: Date.now() - t0, event: 'error', url, error }));
      socket.on('close', () => ws.write({ t: Date.now() - t0, event: 'close', url }));
    });
  };
  context.on('page', attachPage);

  const page = await context.newPage();
  const shot = async (name: string) => {
    const file = join(opts.shotsDir, `${vpName}-${String(stats.screenshots.length).padStart(2, '0')}-${name}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 70 }).catch(() => undefined);
    if (existsSync(file)) stats.screenshots.push(file);
  };

  try {
    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch (err) {
    consoleLog.write({ t: Date.now() - t0, kind: 'navigation-error', text: String(err) });
  }
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await shot('loaded');

  for (const step of opts.steps) {
    if (step.viewport && step.viewport !== vpName) continue;
    try {
      switch (step.action) {
        case 'wait':
          await page.waitForTimeout(step.ms);
          break;
        case 'click':
          await page.click(step.selector, { timeout: 15_000 });
          break;
        case 'clickAt':
          await page.mouse.click(step.x, step.y);
          break;
        case 'type':
          await page.fill(step.selector, step.text, { timeout: 15_000 });
          break;
        case 'press':
          await page.keyboard.press(step.key);
          break;
        case 'goto':
          await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          break;
        case 'screenshot':
          await shot(step.name);
          break;
      }
    } catch (err) {
      consoleLog.write({ t: Date.now() - t0, kind: 'step-error', step, text: String(err) });
    }
  }

  // Quan sát thêm, chụp theo mốc 5s / 15s / cuối.
  const marks = [5, 15, opts.waitSeconds].filter((s, i, arr) => s <= opts.waitSeconds && arr.indexOf(s) === i);
  let elapsed = 0;
  for (const mark of marks) {
    await page.waitForTimeout((mark - elapsed) * 1000);
    elapsed = mark;
    await shot(`t${mark}s`);
  }

  // Probe mọi frame (game H5 hay nằm trong iframe).
  const probes: (ProbeResult & { frameUrl: string })[] = [];
  for (const frame of page.frames()) {
    stats.frames.push(redactUrl(frame.url()));
    try {
      const result = await frame.evaluate(browserProbe, baselineKeys);
      probes.push({ ...result, frameUrl: redactUrl(frame.url()) });
      const html = await frame.content();
      const name = frame === page.mainFrame() ? 'main' : `frame-${probes.length - 1}`;
      ensureDir(join(vpDir, 'dom'));
      writeFileSync(join(vpDir, 'dom', `${name}.html`), html);
    } catch (err) {
      consoleLog.write({ t: Date.now() - t0, kind: 'probe-error', frame: frame.url(), text: String(err) });
    }
  }
  writeJson(join(vpDir, 'probe.json'), probes);
  return stats;
}

async function staticRecon(context: BrowserContext, opts: CaptureOptions) {
  const origin = new URL(opts.url).origin;
  const paths = ['/robots.txt', '/sitemap.xml', '/manifest.json', '/site.webmanifest', '/.well-known/security.txt', '/favicon.ico'];
  const results: CaptureSummary['staticRecon'] = [];
  const dir = ensureDir(join(opts.outDir, 'static'));
  for (const path of paths) {
    try {
      const res = await context.request.get(origin + path, { timeout: 20_000, maxRedirects: 3 });
      const body = await res.body();
      const file = res.ok() && path !== '/favicon.ico' ? join(dir, path.replace(/\//g, '_').replace(/^_/, '')) : undefined;
      if (file) writeFileSync(file, body);
      results.push({ path, status: res.status(), bytes: body.length, ...(file ? { file } : {}) });
    } catch {
      results.push({ path, status: null, bytes: 0 });
    }
    await new Promise((r) => setTimeout(r, 500)); // lịch sự: ≤ 2 req/s
  }
  return results;
}

// ---------------------------------------------------------------- CLI
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs();
  const url = argString(args, 'url');
  if (!url) {
    console.error('Thiếu --url. Ví dụ: pnpm capture --url https://fworldgm.com/ [--wait 30] [--viewport desktop --viewport mobile] [--steps steps.json] [--storage-state state.json] [--headed]');
    process.exit(1);
  }
  const slug = argString(args, 'slug', slugFromUrl(url))!;
  const outDir = resolve(argString(args, 'out', join(REPO_ROOT, 'research', slug, 'raw', `capture-${timestamp()}`))!);
  const shotsDir = resolve(argString(args, 'shots', join(REPO_ROOT, 'research', slug, 'screenshots'))!);
  const stepsPath = argString(args, 'steps');
  const steps: Step[] = stepsPath ? JSON.parse(readFileSync(stepsPath, 'utf8')) : [];
  const viewports = argList(args, 'viewport');
  const summary = await runCapture({
    url,
    outDir,
    shotsDir,
    waitSeconds: argNumber(args, 'wait', 30),
    viewports: viewports.length ? viewports : ['desktop', 'mobile'],
    steps,
    storageState: argString(args, 'storage-state'),
    headed: args.headed === true,
    skipStatic: args['skip-static'] === true,
  });
  for (const [vp, s] of Object.entries(summary.viewports)) {
    const harSize = existsSync(s.har) ? statSync(s.har).size : 0;
    console.log(`[${vp}] requests=${s.requests} failed=${s.failedRequests} ws=${s.websockets} frames=${s.wsFrames} shots=${s.screenshots.length} har=${relative(REPO_ROOT, s.har)} (${harSize} B)`);
  }
  if (summary.blockedHosts.length) {
    console.log('\nHost bị chặn / không kết nối được (cần thêm vào Allowed domains nếu là host của game):');
    for (const h of summary.blockedHosts) console.log(`  - ${h}`);
  }
  console.log(`\nKết quả: ${relative(REPO_ROOT, outDir)}/summary.json`);
}
