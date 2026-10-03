import { mkdirSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Thư mục gốc của repo (tools/inspect/src/lib → ../../../..). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export type Args = Record<string, string | boolean | string[]>;

/** Parse `--key value`, `--flag`, và `--key a --key b` (lặp lại → mảng). */
export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    const value: string | boolean = next !== undefined && !next.startsWith('--') ? (i++, next) : true;
    const prev = out[key];
    if (prev === undefined) out[key] = value;
    else if (Array.isArray(prev)) prev.push(String(value));
    else out[key] = [String(prev), String(value)];
  }
  return out;
}

export function argString(args: Args, key: string, fallback?: string): string | undefined {
  const v = args[key];
  if (v === undefined || v === true) return fallback;
  return Array.isArray(v) ? v[v.length - 1] : String(v);
}

export function argList(args: Args, key: string): string[] {
  const v = args[key];
  if (v === undefined || v === true) return [];
  return Array.isArray(v) ? v : [String(v)];
}

export function argNumber(args: Args, key: string, fallback: number): number {
  const v = argString(args, key);
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** "https://www.fworldgm.com/x" → "fworldgm". */
export function slugFromUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return host.split('.').slice(0, -1).join('-') || host;
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(path: string, data: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function writeText(path: string, text: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, text);
}

/** Ghi log dạng JSON Lines; tạo file nếu chưa có. */
export class JsonlWriter {
  constructor(readonly path: string) {
    ensureDir(dirname(path));
    writeFileSync(path, '');
  }
  write(record: unknown): void {
    appendFileSync(this.path, JSON.stringify(record) + '\n');
  }
}

/** Liệt kê đệ quy mọi file trong thư mục (bỏ qua node_modules). */
export function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      if (name === 'node_modules') continue;
      const full = join(current, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out.sort();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}… (+${text.length - max} ký tự)`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Bảng markdown đơn giản. */
export function mdTable(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `| ${headers.map(esc).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ].join('\n');
}
