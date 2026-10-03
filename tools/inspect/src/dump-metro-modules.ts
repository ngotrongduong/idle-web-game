/**
 * Dump các module dữ liệu (hằng số viết HOA: CLASSES, ITEMS, DUNGEONS...) của một app
 * Expo / React Native Web (bundle Metro) bằng cách gọi registry `__r(id)` trong trình duyệt.
 * Chỉ đọc export phía client; không gọi API server.
 *
 * Ví dụ: pnpm dump-metro --url https://fworldgm.com/ --out research/fworldgm/raw/static/metro-exports.json
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { argNumber, argString, parseArgs, writeJson } from './lib/util.ts';

export async function dumpMetroModules(url: string, maxId: number): Promise<Record<string, unknown>> {
  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ ...(proxyServer ? { proxy: { server: proxyServer, bypass: 'localhost,127.0.0.1,::1' } } : {}) });
  try {
    const page = await browser.newPage();
    await page.addInitScript('globalThis.__name = globalThis.__name || ((f) => f);');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => typeof (window as any).__r === 'function', undefined, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    return await page.evaluate((max) => {
      const w = window as any;
      const out: Record<string, unknown> = {};
      // Chỉ coi là vòng lặp khi object xuất hiện lại trên chính đường đi hiện tại (tổ tiên),
      // object dùng chung ở nhiều nơi vẫn được dump đầy đủ.
      const stack = new Set<object>();
      const clean = (v: unknown, depth: number): unknown => {
        if (depth > 12) return '[depth]';
        if (typeof v === 'function') return '[function]';
        if (v === null || typeof v !== 'object') return v;
        if (stack.has(v as object)) return '[circular]';
        if ((v as any).$$typeof) return '[react-element]';
        stack.add(v as object);
        try {
          if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
          const o: Record<string, unknown> = {};
          for (const [k, x] of Object.entries(v as object)) o[k] = clean(x, depth + 1);
          return o;
        } finally {
          stack.delete(v as object);
        }
      };
      for (let id = 0; id < max; id++) {
        let mod: any;
        try {
          mod = w.__r(id);
        } catch {
          continue;
        }
        if (!mod || typeof mod !== 'object') continue;
        const keys = Object.keys(mod).filter((k) => /^[A-Z][A-Z0-9_]+$/.test(k));
        if (!keys.length) continue;
        const entry: Record<string, unknown> = {};
        for (const k of keys) {
          try {
            entry[k] = clean(mod[k], 0);
          } catch (e) {
            entry[k] = `[error ${String(e)}]`;
          }
        }
        out[`module_${id}`] = entry;
      }
      return out;
    }, maxId);
  } finally {
    await browser.close();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs();
  const url = argString(args, 'url');
  const out = argString(args, 'out');
  if (!url || !out) {
    console.error('Cần --url và --out. Tuỳ chọn: --max-id 5000');
    process.exit(1);
  }
  const result = await dumpMetroModules(url, argNumber(args, 'max-id', 5000));
  writeJson(resolve(out), result);
  console.log(`${Object.keys(result).length} module có hằng số viết hoa → ${out}`);
}
