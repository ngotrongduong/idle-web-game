/**
 * Che thông tin nhạy cảm (cookie, token, chữ ký, mật khẩu) trước khi ghi báo cáo
 * vào repo. HAR gốc vẫn nằm trong thư mục raw/ (gitignored).
 */

export const SENSITIVE_KEY = /(token|session|sess_?id|^sid$|auth|passw|pwd|secret|sign(ature)?$|^sign|ticket|cookie|api_?key|access_?key|credential|otp|phone|email)/i;

const SENSITIVE_HEADERS = new Set([
  'cookie',
  'set-cookie',
  'authorization',
  'proxy-authorization',
  'x-token',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-xsrf-token',
]);

export const REDACTED = '[REDACTED]';

export function redactHeaders(headers: { name: string; value: string }[]): { name: string; value: string }[] {
  return headers.map(({ name, value }) =>
    SENSITIVE_HEADERS.has(name.toLowerCase()) || SENSITIVE_KEY.test(name) ? { name, value: REDACTED } : { name, value },
  );
}

export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, REDACTED);
    }
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
    }
    return url.toString();
  } catch {
    return raw;
  }
}

/** Che đệ quy giá trị của các key nhạy cảm trong object JSON. */
export function redactJson(value: unknown, depth = 0): unknown {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactJson(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) && (typeof v === 'string' || typeof v === 'number') ? REDACTED : redactJson(v, depth + 1);
  }
  return out;
}

/** Che một chuỗi body: JSON → redactJson; form-urlencoded → che theo key; còn lại giữ nguyên. */
export function redactBody(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(redactJson(JSON.parse(trimmed)));
    } catch {
      /* không phải JSON hợp lệ */
    }
  }
  if (/^[\w.%-]+=[^&]*(&[\w.%-]+=[^&]*)*$/.test(trimmed)) {
    const params = new URLSearchParams(trimmed);
    for (const key of [...params.keys()]) if (SENSITIVE_KEY.test(key)) params.set(key, REDACTED);
    return params.toString();
  }
  return text;
}
