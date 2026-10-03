/**
 * Quét các file JSON (body đã xuất bởi analyze-har.ts, hoặc thư mục bất kỳ) để tìm
 * "bảng config" của game: item, quái, stage, exp curve, VIP, shop...
 *
 * Nhận diện 3 dạng phổ biến:
 *  - mảng object:            [{id:1, hp:100}, {id:2, hp:120}, ...]
 *  - map id → object:        {"1001": {name:..}, "1002": {...}}
 *  - dạng cột (xuất từ Excel): [["id","exp"], [1,100], [2,150]] hoặc {header:[..], rows:[[..]]}
 *
 * Output:
 *  - data/config-tables.json : index + thống kê từng cột + đường cong tăng trưởng (commit được)
 *  - 03-config-tables.md     : bản đọc cho người
 *  - raw/tables/*.json       : bảng đầy đủ (gitignored; dùng --full để ghi vào data/tables)
 *
 * Ví dụ: pnpm extract --dir research/fworldgm/raw/bodies --slug fworldgm
 */
import { readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { REPO_ROOT, argNumber, argString, mdTable, parseArgs, truncate, walkFiles, writeJson, writeText } from './lib/util.ts';

type Row = Record<string, unknown>;

export interface ColumnStats {
  name: string;
  types: string[];
  nonNull: number;
  distinct: number;
  min?: number;
  max?: number;
  mean?: number;
  samples: string[];
  hint?: string;
}

export interface Curve {
  x: string;
  y: string;
  points: number;
  first: number;
  last: number;
  /** Tỉ lệ y[i+1]/y[i] trung bình (gợi ý hàm mũ) */
  meanRatio: number;
  /** Hiệu y[i+1]-y[i] trung bình (gợi ý tuyến tính) */
  meanDelta: number;
  /** Gợi ý dạng hàm phù hợp nhất */
  fit: 'linear' | 'exponential' | 'polynomial' | 'unknown';
  /** Với polynomial: y ≈ a * x^b */
  power?: { a: number; b: number; r2: number };
}

export interface TableInfo {
  id: string;
  file: string;
  path: string;
  format: 'array' | 'map' | 'columnar';
  rows: number;
  columns: ColumnStats[];
  curves: Curve[];
  sample: Row[];
}

const HINTS: [RegExp, string][] = [
  [/^(id|.*_id|.*Id|key)$/, 'khóa'],
  [/(^lv$|level|^lvl|rank|tier|^grade)/i, 'cấp độ'],
  [/(exp|xp)/i, 'kinh nghiệm'],
  [/(hp|life|blood|health)/i, 'máu'],
  [/(atk|attack|dmg|damage)/i, 'tấn công'],
  [/(def|armor|armour)/i, 'phòng thủ'],
  [/(spd|speed|agi)/i, 'tốc độ'],
  [/(^crit|crit$|critdmg|crit_|_crit)/i, 'chí mạng'],
  [/(power|fight|combat|zhanli|bp$)/i, 'lực chiến'],
  [/(cost|price|gold|coin|money|silver)/i, 'giá / vàng'],
  [/(diamond|gem|ingot|yuanbao|crystal|jade)/i, 'tiền cao cấp'],
  [/(rate|prob|weight|chance|odds|percent)/i, 'tỉ lệ / trọng số'],
  [/vip/i, 'VIP'],
  [/(stage|chapter|map|dungeon|floor|wave)/i, 'màn / chương'],
  [/(quality|rarity|star|color)/i, 'phẩm chất / sao'],
  [/(reward|drop|loot|award|item)/i, 'phần thưởng / vật phẩm'],
  [/(time|duration|cd|cooldown|sec|minute|hour)/i, 'thời gian'],
  [/(name|title|desc|text|label)/i, 'văn bản'],
  [/(skill|buff|effect)/i, 'kỹ năng / hiệu ứng'],
];

function hintFor(name: string): string | undefined {
  return HINTS.find(([re]) => re.test(name))?.[1];
}

const isPlainObject = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tìm các bảng trong một giá trị JSON (đệ quy tới depth 5). */
export function findTables(value: unknown, file: string, minRows: number, path = '$', depth = 0, out: { path: string; format: TableInfo['format']; rows: Row[] }[] = []) {
  if (depth > 5) return out;
  if (Array.isArray(value)) {
    const objects = value.filter(isPlainObject);
    if (value.length >= minRows && objects.length / value.length >= 0.8) {
      out.push({ path, format: 'array', rows: objects });
      return out;
    }
    // Dạng cột: hàng đầu toàn chuỗi, các hàng sau là mảng cùng độ dài.
    if (value.length > minRows && Array.isArray(value[0]) && (value[0] as unknown[]).every((c) => typeof c === 'string')) {
      const headers = value[0] as string[];
      const body = value.slice(1).filter((r): r is unknown[] => Array.isArray(r) && r.length === headers.length);
      if (body.length >= minRows) {
        out.push({ path, format: 'columnar', rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))) });
        return out;
      }
    }
    value.slice(0, 50).forEach((v, i) => findTables(v, file, minRows, `${path}[${i}]`, depth + 1, out));
    return out;
  }
  if (isPlainObject(value)) {
    // {header:[...], rows/data/list:[[...]]}
    const headerKey = ['header', 'headers', 'fields', 'keys', 'columns'].find((k) => Array.isArray(value[k]));
    const rowsKey = ['rows', 'data', 'list', 'values', 'records'].find((k) => Array.isArray(value[k]));
    if (headerKey && rowsKey) {
      const headers = (value[headerKey] as unknown[]).map(String);
      const body = (value[rowsKey] as unknown[]).filter((r): r is unknown[] => Array.isArray(r));
      if (body.length >= minRows) {
        out.push({ path, format: 'columnar', rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))) });
        return out;
      }
    }
    const entries = Object.entries(value);
    const objectValues = entries.filter(([, v]) => isPlainObject(v));
    if (entries.length >= minRows && objectValues.length / entries.length >= 0.8) {
      // Map id → object: chỉ coi là bảng nếu các object có key giống nhau phần lớn.
      const keySets = objectValues.slice(0, 50).map(([, v]) => Object.keys(v as Row).sort().join(','));
      const mostCommon = Math.max(...Object.values(keySets.reduce<Record<string, number>>((acc, k) => ((acc[k] = (acc[k] ?? 0) + 1), acc), {})));
      if (mostCommon / keySets.length >= 0.5) {
        out.push({ path, format: 'map', rows: objectValues.map(([k, v]) => ({ __key: k, ...(v as Row) })) });
        return out;
      }
    }
    for (const [k, v] of entries.slice(0, 200)) findTables(v, file, minRows, `${path}.${k}`, depth + 1, out);
  }
  return out;
}

export function columnStats(rows: Row[]): ColumnStats[] {
  const names = new Set<string>();
  for (const r of rows.slice(0, 2000)) for (const k of Object.keys(r)) names.add(k);
  return [...names].slice(0, 120).map((name) => {
    const values = rows.map((r) => r[name]).filter((v) => v !== null && v !== undefined && v !== '');
    const types = [...new Set(values.map((v) => (Array.isArray(v) ? 'array' : typeof v)))];
    const nums = values.map((v) => (typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN)).filter(Number.isFinite);
    const distinctValues = new Set(values.map((v) => JSON.stringify(v)));
    const stats: ColumnStats = {
      name,
      types,
      nonNull: values.length,
      distinct: distinctValues.size,
      samples: [...distinctValues].slice(0, 4).map((s) => truncate(s, 60)),
      ...(hintFor(name) ? { hint: hintFor(name) } : {}),
    };
    if (nums.length >= values.length * 0.8 && nums.length > 0) {
      stats.min = Math.min(...nums);
      stats.max = Math.max(...nums);
      stats.mean = Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(3));
    }
    return stats;
  });
}

/** Tìm đường cong: cột x là cấp độ/màn tăng dần, cột y là số tăng dần (exp, giá, hp...). */
export function detectCurves(rows: Row[], columns: ColumnStats[]): Curve[] {
  const numeric = columns.filter((c) => c.min !== undefined && c.distinct > 3);
  const xCols = numeric.filter((c) => /cấp độ|màn|khóa/.test(c.hint ?? ''));
  const curves: Curve[] = [];
  for (const x of xCols) {
    for (const y of numeric) {
      if (y.name === x.name || /khóa|cấp độ/.test(y.hint ?? '')) continue;
      const pts = rows
        .map((r) => [Number(r[x.name]), Number(r[y.name])] as const)
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))
        .sort((a, b) => a[0] - b[0]);
      if (pts.length < 5) continue;
      const increasing = pts.every((p, i) => i === 0 || p[1] >= pts[i - 1]![1]);
      if (!increasing || pts[0]![1] === pts[pts.length - 1]![1]) continue;
      const ratios: number[] = [];
      const deltas: number[] = [];
      for (let i = 1; i < pts.length; i++) {
        if (pts[i - 1]![1] > 0) ratios.push(pts[i]![1] / pts[i - 1]![1]);
        deltas.push(pts[i]![1] - pts[i - 1]![1]);
      }
      const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
      const cv = (a: number[]) => {
        const m = mean(a);
        return m === 0 ? Infinity : Math.sqrt(mean(a.map((v) => (v - m) ** 2))) / Math.abs(m);
      };
      const power = fitPower(pts.filter(([a, b]) => a > 0 && b > 0));
      let fit: Curve['fit'] = 'unknown';
      if (cv(deltas) < 0.05) fit = 'linear';
      else if (cv(ratios) < 0.05) fit = 'exponential';
      else if (power && power.r2 > 0.98) fit = 'polynomial';
      curves.push({
        x: x.name,
        y: y.name,
        points: pts.length,
        first: pts[0]![1],
        last: pts[pts.length - 1]![1],
        meanRatio: Number(mean(ratios).toFixed(4)),
        meanDelta: Number(mean(deltas).toFixed(2)),
        fit,
        ...(power ? { power } : {}),
      });
    }
  }
  return curves.slice(0, 20);
}

/** Hồi quy log-log: y = a * x^b. */
function fitPower(pts: (readonly [number, number])[]): Curve['power'] | undefined {
  if (pts.length < 5) return undefined;
  const xs = pts.map(([x]) => Math.log(x));
  const ys = pts.map(([, y]) => Math.log(y));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return undefined;
  const b = sxy / sxx;
  const a = Math.exp(my - b * mx);
  const r2 = (sxy * sxy) / (sxx * syy);
  return { a: Number(a.toFixed(4)), b: Number(b.toFixed(4)), r2: Number(r2.toFixed(4)) };
}

export function extractFromDir(dir: string, minRows: number): { tables: TableInfo[]; fullTables: Record<string, Row[]>; skipped: string[] } {
  const tables: TableInfo[] = [];
  const fullTables: Record<string, Row[]> = {};
  const skipped: string[] = [];
  for (const file of walkFiles(dir)) {
    if (statSync(file).size > 50 * 1024 * 1024) {
      skipped.push(`${file} (quá lớn)`);
      continue;
    }
    const buf = readFileSync(file);
    const head = buf.subarray(0, 64).toString('utf8').trimStart();
    if (!(head.startsWith('{') || head.startsWith('['))) {
      if (/\.(bin|zip|dat|bytes|pb)$/i.test(file)) skipped.push(`${file} (nhị phân: cần giải mã thủ công)`);
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(buf.toString('utf8'));
    } catch {
      continue;
    }
    const rel = relative(dir, file);
    for (const found of findTables(json, rel, minRows)) {
      const columns = columnStats(found.rows);
      const id = `${rel}#${found.path}`;
      tables.push({ id, file: rel, path: found.path, format: found.format, rows: found.rows.length, columns, curves: detectCurves(found.rows, columns), sample: found.rows.slice(0, 3) });
      fullTables[id] = found.rows;
    }
  }
  tables.sort((a, b) => b.rows - a.rows);
  return { tables, fullTables, skipped };
}

export function renderTablesMarkdown(tables: TableInfo[], skipped: string[], title: string): string {
  const lines = [
    `# ${title}`,
    '',
    `> Sinh tự động bởi \`tools/inspect/src/extract-config.ts\`. ${tables.length} bảng được phát hiện.`,
    '',
    mdTable(['#', 'Bảng', 'Dạng', 'Số dòng', 'Số cột', 'Cột gợi ý'], tables.map((t, i) => [i + 1, truncate(t.id, 90), t.format, t.rows, t.columns.length, t.columns.filter((c) => c.hint).map((c) => `${c.name}(${c.hint})`).slice(0, 6).join(', ')])),
    '',
  ];
  for (const t of tables.slice(0, 100)) {
    lines.push(`## ${t.id}`, '', `Dạng: ${t.format} · ${t.rows} dòng`, '');
    lines.push(mdTable(['Cột', 'Kiểu', 'Gợi ý', 'Min', 'Max', 'TB', 'Distinct', 'Mẫu'], t.columns.map((c) => [c.name, c.types.join('/'), c.hint ?? '', c.min ?? '', c.max ?? '', c.mean ?? '', c.distinct, c.samples.join(' · ')])), '');
    if (t.curves.length) {
      lines.push('Đường cong tăng trưởng:', '', mdTable(['x', 'y', 'Điểm', 'Đầu', 'Cuối', 'Tỉ lệ TB', 'Hiệu TB', 'Dạng', 'y≈a·x^b'], t.curves.map((c) => [c.x, c.y, c.points, c.first, c.last, c.meanRatio, c.meanDelta, c.fit, c.power ? `a=${c.power.a}, b=${c.power.b}, R²=${c.power.r2}` : ''])), '');
    }
  }
  if (skipped.length) lines.push('## Bỏ qua', '', ...skipped.map((s) => `- ${s}`), '');
  return lines.join('\n');
}

// ------------------------------------------------------------ CLI
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs();
  const slug = argString(args, 'slug', 'fworldgm')!;
  const researchDir = join(REPO_ROOT, 'research', slug);
  const dir = resolve(argString(args, 'dir', join(researchDir, 'raw', 'bodies'))!);
  const outDir = resolve(argString(args, 'out', researchDir)!);
  const { tables, fullTables, skipped } = extractFromDir(dir, argNumber(args, 'min-rows', 5));
  writeJson(join(outDir, 'data', 'config-tables.json'), { generatedAt: new Date().toISOString(), source: relative(REPO_ROOT, dir), tables, skipped });
  writeText(join(outDir, '03-config-tables.md'), renderTablesMarkdown(tables, skipped, `Bảng config phát hiện: ${slug}`));
  const fullDir = args.full === true ? join(outDir, 'data', 'tables') : join(outDir, 'raw', 'tables');
  for (const [id, rows] of Object.entries(fullTables)) writeJson(join(fullDir, `${id.replace(/[^\w.-]+/g, '_').slice(0, 150)}.json`), rows);
  console.log(`${tables.length} bảng · ${skipped.length} file bỏ qua · index: ${relative(REPO_ROOT, join(outDir, 'data', 'config-tables.json'))}`);
}
