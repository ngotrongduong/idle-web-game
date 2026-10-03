/**
 * Phân tích một hoặc nhiều file HAR (từ capture.ts hoặc từ Chrome DevTools "Save all as HAR")
 * + file ws.jsonl (nếu có) → báo cáo kỹ thuật:
 *  - host/CDN, thống kê tài nguyên theo loại và đuôi file, tài nguyên lớn nhất
 *  - nhận diện engine/SDK/thanh toán qua nội dung JS/HTML
 *  - danh mục API (gom theo method + path pattern), mẫu request/response đã che token
 *  - WebSocket: URL, số frame, kiểu message (JSON key / cmd / route), mẫu
 *  - URL & endpoint tìm thấy trong JS, chuỗi tiếng Việt / tiếng Trung, source map
 *  - xuất body ra thư mục raw/bodies để extract-config.ts dùng tiếp
 *
 * Ví dụ:
 *   pnpm analyze --har research/fworldgm/raw/capture-xxx --slug fworldgm
 *   pnpm analyze --har research/fworldgm/user-provided/fworldgm.har --slug fworldgm
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fingerprintTexts, type FingerprintHit } from './lib/fingerprint.ts';
import { redactBody, redactJson, redactUrl } from './lib/redact.ts';
import {
  REPO_ROOT,
  argList,
  argString,
  ensureDir,
  formatBytes,
  mdTable,
  parseArgs,
  truncate,
  walkFiles,
  writeJson,
  writeText,
} from './lib/util.ts';

// ------------------------------------------------------------ Kiểu HAR (tối thiểu)
interface HarHeader { name: string; value: string }
interface HarWsMessage { type: 'send' | 'receive'; time: number; opcode: number; data: string }
interface HarEntry {
  startedDateTime: string;
  time: number;
  _resourceType?: string;
  _webSocketMessages?: HarWsMessage[];
  request: { method: string; url: string; headers: HarHeader[]; postData?: { mimeType?: string; text?: string } };
  response: {
    status: number;
    headers: HarHeader[];
    content: { size: number; mimeType?: string; text?: string; encoding?: string };
    bodySize?: number;
    _transferSize?: number;
  };
}

export interface WsFrame { url: string; direction: 'send' | 'receive'; opcode: number; data: string; t: number }

export interface AnalysisResult {
  generatedAt: string;
  inputs: string[];
  totals: { requests: number; bytes: number; hosts: number; websockets: number; wsFrames: number };
  hosts: { host: string; requests: number; bytes: number; types: Record<string, number>; server?: string; cdn?: string }[];
  byType: Record<string, { count: number; bytes: number }>;
  byExtension: Record<string, { count: number; bytes: number }>;
  largest: { url: string; type: string; bytes: number }[];
  scripts: { url: string; bytes: number; hasSourceMap: boolean }[];
  fingerprints: FingerprintHit[];
  api: {
    key: string;
    method: string;
    host: string;
    pathPattern: string;
    count: number;
    statuses: number[];
    requestMime?: string;
    responseMime?: string;
    sampleRequest?: string;
    sampleResponse?: string;
    responseJsonKeys?: string[];
  }[];
  websockets: {
    url: string;
    frames: { send: number; receive: number; text: number; binary: number };
    messageShapes: { shape: string; count: number; direction: string; sample: string }[];
    commandField?: string;
    commands?: { value: string; count: number }[];
    binaryPreview: string[];
  }[];
  discoveredUrls: string[];
  discoveredPaths: string[];
  strings: { vietnamese: { count: number; samples: string[] }; cjk: { count: number; samples: string[] } };
  bodiesDir?: string;
}

// ------------------------------------------------------------ Phân loại
const EXT_TYPE: Record<string, string> = {
  '.js': 'script', '.mjs': 'script', '.css': 'stylesheet', '.html': 'document', '.htm': 'document',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image', '.svg': 'image', '.avif': 'image', '.ktx': 'image', '.pvr': 'image', '.astc': 'image',
  '.mp3': 'audio', '.ogg': 'audio', '.wav': 'audio', '.m4a': 'audio', '.aac': 'audio',
  '.mp4': 'video', '.webm': 'video',
  '.woff': 'font', '.woff2': 'font', '.ttf': 'font', '.otf': 'font', '.fnt': 'font',
  '.json': 'json', '.atlas': 'atlas', '.plist': 'atlas', '.skel': 'skeleton', '.bin': 'binary', '.wasm': 'wasm', '.zip': 'archive', '.proto': 'proto',
};

function classify(entry: HarEntry): string {
  const rt = entry._resourceType?.toLowerCase();
  if (rt === 'websocket') return 'websocket';
  if (rt === 'xhr' || rt === 'fetch') {
    const mime = entry.response.content.mimeType ?? '';
    return /json/.test(mime) ? 'api-json' : 'xhr';
  }
  const ext = extOf(entry.request.url);
  if (EXT_TYPE[ext]) return EXT_TYPE[ext]!;
  const mime = entry.response.content.mimeType ?? '';
  if (/javascript/.test(mime)) return 'script';
  if (/json/.test(mime)) return 'json';
  if (/html/.test(mime)) return 'document';
  if (/css/.test(mime)) return 'stylesheet';
  if (/^image\//.test(mime)) return 'image';
  if (/^audio\//.test(mime)) return 'audio';
  if (/font/.test(mime)) return 'font';
  return rt ?? 'other';
}

function extOf(url: string): string {
  try {
    return extname(new URL(url).pathname).toLowerCase();
  } catch {
    return '';
  }
}

function bodyText(entry: HarEntry): string | undefined {
  const c = entry.response.content;
  if (c.text === undefined) return undefined;
  if (c.encoding === 'base64') {
    const mime = c.mimeType ?? '';
    if (!/(text|json|javascript|xml|html|css)/.test(mime) && !['.js', '.json', '.html', '.css', '.atlas', '.plist', '.txt'].includes(extOf(entry.request.url))) return undefined;
    return Buffer.from(c.text, 'base64').toString('utf8');
  }
  return c.text;
}

function bodyBytes(entry: HarEntry): Buffer | undefined {
  const c = entry.response.content;
  if (c.text === undefined) return undefined;
  return c.encoding === 'base64' ? Buffer.from(c.text, 'base64') : Buffer.from(c.text, 'utf8');
}

function entrySize(entry: HarEntry): number {
  const c = entry.response.content;
  return Math.max(c.size ?? 0, entry.response._transferSize ?? 0, entry.response.bodySize ?? 0, 0);
}

/** /api/user/12345/items?x=1 → /api/user/:id/items */
export function pathPattern(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname
      .split('/')
      .map((seg) => (/^\d+$/.test(seg) ? ':id' : /^[0-9a-f]{16,}$/i.test(seg) ? ':hash' : /^[0-9a-f-]{36}$/i.test(seg) ? ':uuid' : seg))
      .join('/');
  } catch {
    return url;
  }
}

const header = (headers: HarHeader[], name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value;

/** Mô tả "hình dạng" của một JSON: danh sách key cấp 1 (sắp xếp). */
function jsonShape(value: unknown): string {
  if (Array.isArray(value)) return `array[${value.length > 0 ? jsonShape(value[0]) : ''}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().join(',')}}`;
  return typeof value;
}

const COMMAND_FIELDS = ['cmd', 'command', 'route', 'action', 'type', 'op', 'msgId', 'msgid', 'id', 'protocol', 'method', 'event', 'm', 'c', 'e'];

// ------------------------------------------------------------ Load input
export function loadInputs(paths: string[]): { entries: HarEntry[]; wsFrames: WsFrame[]; files: string[] } {
  const entries: HarEntry[] = [];
  const wsFrames: WsFrame[] = [];
  const files: string[] = [];
  for (const p of paths) {
    const list = existsSync(p) && statSync(p).isDirectory() ? walkFiles(p) : [p];
    for (const file of list) {
      if (file.endsWith('.har')) {
        const har = JSON.parse(readFileSync(file, 'utf8')) as { log: { entries: HarEntry[] } };
        entries.push(...har.log.entries);
        files.push(file);
        for (const e of har.log.entries) {
          for (const m of e._webSocketMessages ?? []) {
            wsFrames.push({ url: e.request.url, direction: m.type, opcode: m.opcode, data: m.data, t: m.time });
          }
        }
      } else if (basename(file) === 'ws.jsonl' || file.endsWith('.ws.jsonl')) {
        files.push(file);
        for (const line of readFileSync(file, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          const rec = JSON.parse(line);
          if (rec.event === 'frame') wsFrames.push({ url: rec.url, direction: rec.direction, opcode: rec.opcode, data: rec.data, t: rec.t });
        }
      }
    }
  }
  return { entries, wsFrames, files };
}

// ------------------------------------------------------------ Phân tích
export function analyze(entries: HarEntry[], wsFrames: WsFrame[], inputs: string[], bodiesDir?: string): AnalysisResult {
  const hosts = new Map<string, AnalysisResult['hosts'][number]>();
  const byType: AnalysisResult['byType'] = {};
  const byExtension: AnalysisResult['byExtension'] = {};
  const sized: { url: string; type: string; bytes: number }[] = [];
  const scripts: AnalysisResult['scripts'] = [];
  const textSources: { name: string; text: string }[] = [];
  const api = new Map<string, AnalysisResult['api'][number]>();
  const wsUrls = new Set<string>();
  let totalBytes = 0;

  for (const entry of entries) {
    let host = '';
    try {
      host = new URL(entry.request.url).host;
    } catch {
      continue;
    }
    if (entry.request.url.startsWith('data:')) continue;
    const type = classify(entry);
    const bytes = entrySize(entry);
    totalBytes += bytes;
    const h = hosts.get(host) ?? { host, requests: 0, bytes: 0, types: {} };
    h.requests++;
    h.bytes += bytes;
    h.types[type] = (h.types[type] ?? 0) + 1;
    h.server ??= header(entry.response.headers, 'server');
    h.cdn ??= header(entry.response.headers, 'cf-cache-status') ? 'cloudflare' : header(entry.response.headers, 'x-amz-cf-id') ? 'cloudfront' : header(entry.response.headers, 'x-cache') ? `x-cache: ${header(entry.response.headers, 'x-cache')}` : undefined;
    hosts.set(host, h);
    (byType[type] ??= { count: 0, bytes: 0 }).count++;
    byType[type]!.bytes += bytes;
    const ext = extOf(entry.request.url) || '(none)';
    (byExtension[ext] ??= { count: 0, bytes: 0 }).count++;
    byExtension[ext]!.bytes += bytes;
    sized.push({ url: redactUrl(entry.request.url), type, bytes });
    if (type === 'websocket') wsUrls.add(redactUrl(entry.request.url));

    const text = bodyText(entry);
    if (text !== undefined && (type === 'script' || type === 'document')) {
      textSources.push({ name: redactUrl(entry.request.url), text });
      if (type === 'script') scripts.push({ url: redactUrl(entry.request.url), bytes: text.length, hasSourceMap: /\/\/# sourceMappingURL=(?!data:)/.test(text) });
    }

    if (bodiesDir) {
      const buf = bodyBytes(entry);
      if (buf && buf.length > 0) {
        const { pathname } = new URL(entry.request.url);
        let rel = pathname.endsWith('/') ? `${pathname}index` : pathname;
        if (!extname(rel) && /json/.test(entry.response.content.mimeType ?? '')) rel += '.json';
        const target = join(bodiesDir, host.replace(/[:]/g, '_'), entry.request.method === 'GET' ? '' : entry.request.method, rel);
        ensureDir(dirname(target));
        writeFileSync(target, buf);
      }
    }

    // API: XHR/fetch, hoặc request không phải GET, hoặc JSON không phải file tĩnh.
    const isApi = type === 'api-json' || type === 'xhr' || entry.request.method !== 'GET' || (type === 'json' && /[?]/.test(entry.request.url));
    if (isApi && type !== 'websocket') {
      const pattern = pathPattern(entry.request.url);
      const key = `${entry.request.method} ${host}${pattern}`;
      const item = api.get(key) ?? { key, method: entry.request.method, host, pathPattern: pattern, count: 0, statuses: [] };
      item.count++;
      if (!item.statuses.includes(entry.response.status)) item.statuses.push(entry.response.status);
      item.requestMime ??= entry.request.postData?.mimeType;
      item.responseMime ??= entry.response.content.mimeType;
      if (!item.sampleRequest && entry.request.postData?.text) item.sampleRequest = truncate(redactBody(entry.request.postData.text), 800);
      if (!item.sampleResponse && text) {
        item.sampleResponse = truncate(redactBody(text), 1500);
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) item.responseJsonKeys = Object.keys(parsed).slice(0, 50);
        } catch {
          /* không phải JSON */
        }
      }
      api.set(key, item);
    }
  }

  // ---- WebSocket
  for (const f of wsFrames) wsUrls.add(redactUrl(f.url));
  const websockets: AnalysisResult['websockets'] = [];
  for (const url of wsUrls) {
    const frames = wsFrames.filter((f) => redactUrl(f.url) === url);
    const shapes = new Map<string, { shape: string; count: number; direction: string; sample: string }>();
    const fieldCounts = new Map<string, Map<string, number>>();
    const binaryPreview: string[] = [];
    let text = 0;
    let binary = 0;
    for (const f of frames) {
      if (f.opcode === 2) {
        binary++;
        if (binaryPreview.length < 10) binaryPreview.push(`${f.direction}: ${Buffer.from(f.data, 'base64').subarray(0, 32).toString('hex')}`);
        continue;
      }
      text++;
      let parsed: unknown;
      // Socket.IO / engine.io: "42[...]" → phần JSON sau tiền tố số.
      const raw = f.data.replace(/^\d+(?=[[{])/, '');
      try {
        parsed = JSON.parse(raw);
      } catch {
        const key = `text:${f.direction}`;
        const s = shapes.get(key) ?? { shape: '(text không phải JSON)', count: 0, direction: f.direction, sample: truncate(f.data, 300) };
        s.count++;
        shapes.set(key, s);
        continue;
      }
      const shape = jsonShape(parsed);
      const key = `${f.direction}:${shape}`;
      const s = shapes.get(key) ?? { shape, count: 0, direction: f.direction, sample: truncate(JSON.stringify(redactJson(parsed)), 500) };
      s.count++;
      shapes.set(key, s);
      const obj = Array.isArray(parsed) ? (typeof parsed[0] === 'string' ? { event: parsed[0] } : parsed[0]) : parsed;
      if (obj && typeof obj === 'object') {
        for (const field of COMMAND_FIELDS) {
          const v = (obj as Record<string, unknown>)[field];
          if (typeof v === 'string' || typeof v === 'number') {
            const m = fieldCounts.get(field) ?? new Map<string, number>();
            m.set(String(v), (m.get(String(v)) ?? 0) + 1);
            fieldCounts.set(field, m);
          }
        }
      }
    }
    // Trường lệnh = trường xuất hiện nhiều nhất và có >1 giá trị khác nhau.
    let commandField: string | undefined;
    let best = 0;
    for (const [field, m] of fieldCounts) {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      if (m.size > 1 && total > best) {
        best = total;
        commandField = field;
      }
    }
    websockets.push({
      url,
      frames: { send: frames.filter((f) => f.direction === 'send').length, receive: frames.filter((f) => f.direction === 'receive').length, text, binary },
      messageShapes: [...shapes.values()].sort((a, b) => b.count - a.count).slice(0, 40),
      ...(commandField
        ? { commandField, commands: [...fieldCounts.get(commandField)!].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count).slice(0, 200) }
        : {}),
      binaryPreview,
    });
  }

  // ---- URL, path, chuỗi trong JS
  const allText = textSources.map((s) => s.text).join('\n');
  const discoveredUrls = [...new Set(allText.match(/\b(?:https?|wss?):\/\/[\w.-]+(?::\d+)?(?:\/[\w./%-]*)?/g) ?? [])]
    .filter((u) => !/w3\.org|schema\.org|mozilla\.org|apache\.org|github\.com\/(facebook|vuejs)|reactjs\.org/.test(u))
    .map(redactUrl)
    .sort()
    .slice(0, 500);
  const discoveredPaths = [...new Set(allText.match(/["'`](\/(?:api|game|user|login|server|pay|order|gm|admin|config|res|cdn|v\d)[\w/.-]*)["'`]/gi) ?? [])]
    .map((s) => s.slice(1, -1))
    .sort()
    .slice(0, 500);
  const viRegex = /[A-Za-zÀ-ỹ0-9 ,.!?:%()-]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ][A-Za-zÀ-ỹ0-9 ,.!?:%()-]*/g;
  const cjkRegex = /[一-鿿㐀-䶿][一-鿿㐀-䶿　-〿＀-￯0-9a-zA-Z ]*/g;
  const collect = (re: RegExp) => {
    const all = (allText.match(re) ?? []).map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 80);
    const unique = [...new Set(all)];
    return { count: unique.length, samples: unique.slice(0, 150) };
  };

  const fingerprints = fingerprintTexts([...textSources, ...[...wsUrls].map((u) => ({ name: u, text: u }))]);

  return {
    generatedAt: new Date().toISOString(),
    inputs: inputs.map((i) => relative(REPO_ROOT, resolve(i))),
    totals: { requests: entries.length, bytes: totalBytes, hosts: hosts.size, websockets: wsUrls.size, wsFrames: wsFrames.length },
    hosts: [...hosts.values()].sort((a, b) => b.requests - a.requests),
    byType,
    byExtension,
    largest: sized.sort((a, b) => b.bytes - a.bytes).slice(0, 30),
    scripts: scripts.sort((a, b) => b.bytes - a.bytes),
    fingerprints,
    api: [...api.values()].sort((a, b) => b.count - a.count),
    websockets,
    discoveredUrls,
    discoveredPaths,
    strings: { vietnamese: collect(viRegex), cjk: collect(cjkRegex) },
    ...(bodiesDir ? { bodiesDir: relative(REPO_ROOT, bodiesDir) } : {}),
  };
}

// ------------------------------------------------------------ Báo cáo markdown
export function renderMarkdown(r: AnalysisResult, title: string): string {
  const sortObj = (o: Record<string, { count: number; bytes: number }>) => Object.entries(o).sort((a, b) => b[1].bytes - a[1].bytes);
  const lines: string[] = [
    `# ${title}`,
    '',
    `> Sinh tự động bởi \`tools/inspect/src/analyze-har.ts\` lúc ${r.generatedAt}. Token/cookie đã được che. Input: ${r.inputs.map((i) => `\`${i}\``).join(', ')}`,
    '',
    '## Tổng quan',
    '',
    mdTable(['Chỉ số', 'Giá trị'], [
      ['Số request', r.totals.requests],
      ['Tổng dung lượng', formatBytes(r.totals.bytes)],
      ['Số host', r.totals.hosts],
      ['WebSocket', r.totals.websockets],
      ['WS frames', r.totals.wsFrames],
    ]),
    '',
    '## Nhận diện công nghệ',
    '',
    r.fingerprints.length
      ? mdTable(['Nhóm', 'Công nghệ', 'Số lần khớp', 'File ví dụ'], r.fingerprints.map((f) => [f.category, f.label, f.matches, f.files.slice(0, 2).join(', ')]))
      : '_Không khớp signature nào._',
    '',
    '## Host / CDN',
    '',
    mdTable(['Host', 'Requests', 'Dung lượng', 'Loại', 'Server', 'CDN'], r.hosts.map((h) => [h.host, h.requests, formatBytes(h.bytes), Object.entries(h.types).map(([k, v]) => `${k}:${v}`).join(' '), h.server ?? '', h.cdn ?? ''])),
    '',
    '## Tài nguyên theo loại',
    '',
    mdTable(['Loại', 'Số lượng', 'Dung lượng'], sortObj(r.byType).map(([k, v]) => [k, v.count, formatBytes(v.bytes)])),
    '',
    '## Tài nguyên theo đuôi file',
    '',
    mdTable(['Đuôi', 'Số lượng', 'Dung lượng'], sortObj(r.byExtension).map(([k, v]) => [k, v.count, formatBytes(v.bytes)])),
    '',
    '## 30 tài nguyên lớn nhất',
    '',
    mdTable(['URL', 'Loại', 'Dung lượng'], r.largest.map((l) => [truncate(l.url, 120), l.type, formatBytes(l.bytes)])),
    '',
    '## JS bundle',
    '',
    r.scripts.length ? mdTable(['URL', 'Kích thước', 'Source map'], r.scripts.map((s) => [truncate(s.url, 120), formatBytes(s.bytes), s.hasSourceMap ? 'có' : ''])) : '_Không có._',
    '',
    '## API (HTTP)',
    '',
    r.api.length
      ? mdTable(['Method', 'Host', 'Path', 'Số lần', 'Status', 'Response keys'], r.api.map((a) => [a.method, a.host, a.pathPattern, a.count, a.statuses.join(','), (a.responseJsonKeys ?? []).join(', ')]))
      : '_Không phát hiện API._',
    '',
  ];
  for (const a of r.api.slice(0, 40)) {
    if (!a.sampleRequest && !a.sampleResponse) continue;
    lines.push(`### \`${a.method} ${a.pathPattern}\``, '');
    if (a.sampleRequest) lines.push('Request:', '```', a.sampleRequest, '```');
    if (a.sampleResponse) lines.push('Response:', '```', a.sampleResponse, '```');
    lines.push('');
  }
  lines.push('## WebSocket', '');
  if (!r.websockets.length) lines.push('_Không có WebSocket._', '');
  for (const w of r.websockets) {
    lines.push(`### ${w.url}`, '', `Frames: gửi ${w.frames.send}, nhận ${w.frames.receive} (text ${w.frames.text}, binary ${w.frames.binary})`, '');
    if (w.commandField) {
      lines.push(`Trường lệnh có khả năng nhất: \`${w.commandField}\``, '', mdTable(['Giá trị', 'Số lần'], (w.commands ?? []).slice(0, 80).map((c) => [c.value, c.count])), '');
    }
    if (w.messageShapes.length) {
      lines.push(mdTable(['Chiều', 'Shape', 'Số lần', 'Mẫu'], w.messageShapes.map((s) => [s.direction, truncate(s.shape, 80), s.count, truncate(s.sample, 200)])), '');
    }
    if (w.binaryPreview.length) lines.push('Binary (32 byte đầu, hex):', '```', ...w.binaryPreview, '```', '');
  }
  lines.push(
    '## URL tìm thấy trong JS',
    '',
    r.discoveredUrls.length ? r.discoveredUrls.map((u) => `- ${u}`).join('\n') : '_Không có._',
    '',
    '## Path đáng chú ý trong JS',
    '',
    r.discoveredPaths.length ? r.discoveredPaths.map((u) => `- \`${u}\``).join('\n') : '_Không có._',
    '',
    `## Chuỗi tiếng Việt (${r.strings.vietnamese.count} chuỗi khác nhau, hiển thị tối đa 150)`,
    '',
    r.strings.vietnamese.samples.map((s) => `- ${s}`).join('\n') || '_Không có._',
    '',
    `## Chuỗi tiếng Trung (${r.strings.cjk.count} chuỗi khác nhau, hiển thị tối đa 150)`,
    '',
    r.strings.cjk.samples.map((s) => `- ${s}`).join('\n') || '_Không có._',
    '',
  );
  return lines.join('\n');
}

// ------------------------------------------------------------ CLI
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs();
  const inputs = argList(args, 'har');
  if (!inputs.length) {
    console.error('Thiếu --har <file.har | thư mục capture>. Có thể lặp lại nhiều lần. Tuỳ chọn: --slug fworldgm --out <dir> --no-bodies');
    process.exit(1);
  }
  const slug = argString(args, 'slug', 'fworldgm')!;
  const outDir = resolve(argString(args, 'out', join(REPO_ROOT, 'research', slug))!);
  const bodiesDir = args['no-bodies'] === true ? undefined : resolve(argString(args, 'bodies', join(outDir, 'raw', 'bodies'))!);
  const { entries, wsFrames, files } = loadInputs(inputs);
  if (!files.length) {
    console.error('Không tìm thấy file .har hoặc ws.jsonl nào trong input.');
    process.exit(1);
  }
  const result = analyze(entries, wsFrames, files, bodiesDir);
  writeJson(join(outDir, 'data', 'har-analysis.json'), result);
  writeText(join(outDir, '02-har-analysis.md'), renderMarkdown(result, `Phân tích HAR: ${slug}`));
  console.log(`requests=${result.totals.requests} hosts=${result.totals.hosts} api=${result.api.length} ws=${result.websockets.length} frames=${result.totals.wsFrames}`);
  console.log(`engine/SDK: ${result.fingerprints.map((f) => f.label).join(', ') || '(không rõ)'}`);
  console.log(`Báo cáo: ${relative(REPO_ROOT, join(outDir, '02-har-analysis.md'))}`);
}
