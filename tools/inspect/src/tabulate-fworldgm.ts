/**
 * Lập bảng số liệu cho các hàm công thức (export trong module Metro) của fworldgm:
 * chi phí nâng cấp công trình, sức chứa, tỉ lệ cường hoá, đường cong EXP...
 * Chạy hoàn toàn phía client (không gọi API). Script riêng cho game này, dùng tham khảo.
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { argString, parseArgs, writeJson } from './lib/util.ts';

const args = parseArgs();
const out = resolve(argString(args, 'out', 'formulas.json')!);
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({ ...(proxyServer ? { proxy: { server: proxyServer } } : {}) });
const page = await browser.newPage();
await page.addInitScript('globalThis.__name = globalThis.__name || ((f) => f);');
await page.goto('https://fworldgm.com/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof (window as any).__r === 'function');
await page.waitForTimeout(3000);
const result = await page.evaluate(() => {
  const w = window as any;
  const fns: Record<string, Function> = {};
  for (let id = 0; id < 3000; id++) {
    let m: any;
    try {
      m = w.__r(id);
    } catch {
      continue;
    }
    if (!m || typeof m !== 'object') continue;
    for (const [k, v] of Object.entries(m)) if (typeof v === 'function' && /^[a-z]/.test(k) && !(k in fns)) fns[k] = v as Function;
  }
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const tab = (name: string, xs: number[], f: (x: number) => unknown) => {
    try {
      return Object.fromEntries(xs.map((x) => [x, f(x)]));
    } catch (e) {
      return `error: ${String(e)} (${name})`;
    }
  };
  const call = (name: string) => fns[name] ?? (() => undefined);
  const xp: Record<string, unknown> = {};
  for (const tier of [1, 2, 4, 8]) xp[`tier${tier}`] = tab('xpToNext', range(1, 60), (l) => call('xpToNext')(l, tier));
  return {
    availableFunctions: Object.keys(fns).sort(),
    guildUpgradeCost: tab('guildUpgradeCost', range(1, 15), call('guildUpgradeCost') as any),
    guildMaxAdventurers: tab('guildMaxAdventurers', range(1, 15), call('guildMaxAdventurers') as any),
    tavernUpgradeCost: tab('tavernUpgradeCost', range(1, 15), call('tavernUpgradeCost') as any),
    tavernMaxSlots: tab('tavernMaxSlots', range(1, 15), call('tavernMaxSlots') as any),
    inventoryUpgradeCost: tab('inventoryUpgradeCost', range(1, 15), call('inventoryUpgradeCost') as any),
    inventoryMaxSlots: tab('inventoryMaxSlots', range(1, 15), (call('inventoryMaxSlots') ?? call('inventoryCapacity')) as any),
    shopUpgradeCost: tab('shopUpgradeCost', range(1, 15), call('shopUpgradeCost') as any),
    upgradeSuccessRate: tab('upgradeSuccessRate', range(1, 9), call('upgradeSuccessRate') as any),
    xpToNext: xp,
  };
});
writeJson(out, result);
console.log(JSON.stringify(result, null, 0).slice(0, 6000));
await browser.close();
