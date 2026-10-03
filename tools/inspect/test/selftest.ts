/**
 * Self-test không cần mạng/trình duyệt: tạo HAR + ws.jsonl + JSON config giả,
 * chạy analyze() / extractFromDir() / deobfuscate() và kiểm tra kết quả.
 * Chạy: pnpm --filter @idle/inspect test
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, loadInputs, pathPattern } from '../src/analyze-har.ts';
import { extractFromDir } from '../src/extract-config.ts';
import { redactBody, redactUrl } from '../src/lib/redact.ts';
import { deobfuscate } from '../src/deobfuscate-strings.ts';

const dir = mkdtempSync(join(tmpdir(), 'inspect-selftest-'));
const SECRET = 'tok_supersecret_123';
let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

// ---------- Dữ liệu giả
const items = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Kiếm ${i + 1}`, atk: 10 + i * 5, price: 100 * (i + 1) }));
const levels = [['level', 'exp'], ...Array.from({ length: 20 }, (_, i) => [i + 1, Math.round(30 * 1.2 ** i)])];
const gameJs = `
  const app = new PIXI.Application(); const ws = new WebSocket('wss://game.example.com/ws');
  fetch('/api/login'); const label = 'Chiến đấu ngay'; const zh = '战斗开始';
  //# sourceMappingURL=game.js.map
`;
const entry = (method: string, url: string, mime: string, text: string, extra: Record<string, unknown> = {}) => ({
  startedDateTime: new Date().toISOString(),
  time: 10,
  request: { method, url, headers: [{ name: 'Cookie', value: SECRET }], ...extra },
  response: { status: 200, headers: [{ name: 'server', value: 'nginx' }], content: { size: text.length, mimeType: mime, text } },
});
const har = {
  log: {
    entries: [
      entry('GET', 'https://game.example.com/', 'text/html', '<html><script src="/game.js"></script></html>'),
      entry('GET', 'https://game.example.com/game.js', 'application/javascript', gameJs),
      entry('GET', 'https://cdn.example.com/config/items.json', 'application/json', JSON.stringify(items)),
      entry('GET', 'https://cdn.example.com/config/levels.json', 'application/json', JSON.stringify(levels)),
      { ...entry('POST', `https://game.example.com/api/login?token=${SECRET}`, 'application/json', JSON.stringify({ ok: true, token: SECRET, user: { id: 7 } }), { postData: { mimeType: 'application/json', text: JSON.stringify({ username: 'a', password: SECRET }) } }), _resourceType: 'fetch' },
      { ...entry('GET', 'https://game.example.com/api/user/12345/items', 'application/json', '{"items":[]}'), _resourceType: 'xhr' },
    ],
  },
};
const capDir = join(dir, 'capture');
mkdirSync(capDir, { recursive: true });
writeFileSync(join(capDir, 'capture.har'), JSON.stringify(har));
const frames = [
  { event: 'frame', url: 'wss://game.example.com/ws', direction: 'send', opcode: 1, data: JSON.stringify({ cmd: 'login', token: SECRET }), t: 1 },
  { event: 'frame', url: 'wss://game.example.com/ws', direction: 'receive', opcode: 1, data: JSON.stringify({ cmd: 'battle', hp: 100 }), t: 2 },
  { event: 'frame', url: 'wss://game.example.com/ws', direction: 'receive', opcode: 1, data: JSON.stringify({ cmd: 'battle', hp: 80 }), t: 3 },
  { event: 'frame', url: 'wss://game.example.com/ws', direction: 'receive', opcode: 2, data: Buffer.from([1, 2, 3]).toString('base64'), t: 4 },
];
writeFileSync(join(capDir, 'ws.jsonl'), frames.map((f) => JSON.stringify(f)).join('\n'));

// ---------- Kiểm tra
const bodies = join(dir, 'bodies');
const { entries, wsFrames, files } = loadInputs([capDir]);
const result = analyze(entries, wsFrames, files, bodies);
const serialized = JSON.stringify(result);

test('đọc được HAR và ws.jsonl', () => {
  assert.equal(entries.length, 6);
  assert.equal(wsFrames.length, 4);
});
test('nhận diện PixiJS, WebSocket, source map', () => {
  const ids = result.fingerprints.map((f) => f.id);
  for (const id of ['pixi', 'websocket', 'sourcemap']) assert.ok(ids.includes(id), `thiếu ${id}`);
});
test('gom API theo path pattern', () => {
  assert.equal(pathPattern('https://x.com/api/user/12345/items'), '/api/user/:id/items');
  assert.ok(result.api.some((a) => a.method === 'POST' && a.pathPattern === '/api/login'));
  assert.ok(result.api.some((a) => a.pathPattern === '/api/user/:id/items'));
});
test('phân tích WebSocket: trường lệnh = cmd', () => {
  const ws = result.websockets[0]!;
  assert.equal(ws.commandField, 'cmd');
  assert.deepEqual(ws.commands?.map((c) => c.value).sort(), ['battle', 'login']);
  assert.equal(ws.frames.binary, 1);
});
test('trích chuỗi tiếng Việt và tiếng Trung', () => {
  assert.ok(result.strings.vietnamese.samples.some((s) => s.includes('Chiến đấu')));
  assert.ok(result.strings.cjk.samples.some((s) => s.includes('战斗')));
});
test('không lộ token/cookie/mật khẩu trong báo cáo', () => {
  assert.ok(!serialized.includes(SECRET), 'báo cáo chứa secret');
  assert.ok(redactUrl(`https://a.com/?token=${SECRET}&x=1`).includes('x=1'));
  assert.ok(!redactBody(`username=a&password=${SECRET}`).includes(SECRET));
});
test('trích bảng config: mảng object + dạng cột + đường cong EXP', () => {
  const { tables } = extractFromDir(bodies, 5);
  const itemsTable = tables.find((t) => t.file.endsWith('items.json'));
  const levelsTable = tables.find((t) => t.file.endsWith('levels.json'));
  assert.ok(itemsTable && itemsTable.rows === 12 && itemsTable.format === 'array');
  assert.ok(levelsTable && levelsTable.format === 'columnar' && levelsTable.rows === 20);
  const curve = levelsTable.curves.find((c) => c.y === 'exp');
  assert.ok(curve && curve.fit === 'exponential' && Math.abs(curve.meanRatio - 1.2) < 0.01, JSON.stringify(curve));
});
test('giải mã string-array của javascript-obfuscator', () => {
  // Dựng một bundle mini theo đúng cấu trúc obfuscator: decoder + mảng chuỗi + IIFE xoay.
  const arr = ['hello', 'api.php', 'world'];
  const code =
    `function _0xdec(_0xa,_0xb){_0xa=_0xa-0x10;const _0xaa1=_0xb1();return _0xaa1[_0xa];}` +
    `function _0xb1(){const _0xc2=${JSON.stringify(arr)};_0xb1=function(){return _0xc2;};return _0xb1();}` +
    `(function(_0xf1,_0xe1){const _0xa=_0xf1();}(_0xb1,0x1234));` +
    `const _0xdd=_0xdec;console.log(_0xdd(0x11));`;
  const { strings, output } = deobfuscate(code);
  assert.deepEqual(strings, ['hello', 'api.php', 'world']);
  assert.ok(output.includes('console.log("api.php")'));
});

console.log(`\n${passed} test đạt.`);
