/**
 * Giải mã bảng chuỗi của bundle bị javascript-obfuscator (dạng string-array + base64 + rotation).
 * Chỉ chạy phần "header" (hàm decoder + mảng chuỗi + IIFE xoay mảng) trong node:vm,
 * KHÔNG chạy code game. Sau đó thay mọi lời gọi `_0xabc(0x123)` bằng chuỗi literal để đọc được.
 *
 * Ví dụ: pnpm deobf --in research/fworldgm/raw/static/bundle.js --out research/fworldgm/raw/static/bundle.deobf.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { argString, parseArgs } from './lib/util.ts';

export function deobfuscate(code: string): { strings: string[]; output: string; replaced: number } {
  // 1) Hàm decoder đầu file: function _0xNAME(a,b){ ... const arr=_0xARR(); ... }
  const decoderMatch = code.match(/^function (_0x[0-9a-f]+)\(_0x[0-9a-f]+,_0x[0-9a-f]+\)\{_0x[0-9a-f]+=_0x[0-9a-f]+-(0x[0-9a-f]+);const _0x[0-9a-f]+=(_0x[0-9a-f]+)\(\)/);
  if (!decoderMatch) throw new Error('Không nhận ra cấu trúc decoder của javascript-obfuscator');
  const [, decoderName, offsetHex, arrayFnName] = decoderMatch as unknown as [string, string, string, string];
  // 2) Hàm trả về mảng chuỗi: function _0xARR(){const x=[...];_0xARR=function(){return x;};return _0xARR();}
  const arrStart = code.indexOf(`function ${arrayFnName}(){`);
  const arrEndToken = `return ${arrayFnName}();}`;
  const arrEnd = code.indexOf(arrEndToken, arrStart) + arrEndToken.length;
  if (arrStart < 0 || arrEnd < arrEndToken.length) throw new Error('Không tìm thấy hàm mảng chuỗi');
  // 3) IIFE xoay mảng: (function(a,b){...}(_0xARR,0x....));
  const rotStart = code.indexOf('(function(');
  const rotEndMatch = new RegExp(`\\}\\(${arrayFnName},0x[0-9a-f]+\\)\\);?`).exec(code.slice(rotStart));
  if (!rotEndMatch) throw new Error('Không tìm thấy IIFE xoay mảng');
  const rotEnd = rotStart + rotEndMatch.index + rotEndMatch[0].length;
  const header = code.slice(0, rotStart) + code.slice(arrStart, arrEnd) + '\n' + code.slice(rotStart, rotEnd);
  const sandbox: Record<string, unknown> = {};
  vm.createContext(sandbox);
  vm.runInContext(`${header}\nthis.__decode=${decoderName};this.__arr=${arrayFnName};`, sandbox, { timeout: 10_000 });
  const decode = sandbox.__decode as (i: number) => string;
  const arr = (sandbox.__arr as () => string[])();
  const offset = parseInt(offsetHex, 16);
  const strings: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      strings.push(decode(i + offset));
    } catch {
      strings.push('');
    }
  }
  let replaced = 0;
  const output = code.replace(/\b(_0x[0-9a-f]+)\((0x[0-9a-f]+)\)/g, (m, _fn: string, hex: string) => {
    const idx = parseInt(hex, 16) - offset;
    if (idx < 0 || idx >= strings.length) return m;
    replaced++;
    return JSON.stringify(strings[idx]);
  });
  return { strings, output, replaced };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs();
  const input = argString(args, 'in');
  if (!input) {
    console.error('Thiếu --in <bundle.js>. Tuỳ chọn: --out <file> --strings <file.json>');
    process.exit(1);
  }
  const out = argString(args, 'out', input.replace(/\.js$/, '.deobf.js'))!;
  const stringsOut = argString(args, 'strings', input.replace(/\.js$/, '.strings.json'))!;
  const { strings, output, replaced } = deobfuscate(readFileSync(input, 'utf8'));
  writeFileSync(out, output);
  writeFileSync(stringsOut, JSON.stringify(strings, null, 1));
  console.log(`${strings.length} chuỗi giải mã · ${replaced} lời gọi được thay · ${out}`);
}
