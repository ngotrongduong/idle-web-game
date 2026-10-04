import { messages } from "./messages";

export type Locale = "vi" | "en";

/** Vietnam is the launch market, so everyone starts in Vietnamese; the browser language is not read. */
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALES: readonly Locale[] = ["vi", "en"];

export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "en";
}

const LOCALE_TAGS: Record<Locale, string> = { vi: "vi-VN", en: "en-US" };

/** BCP 47 tag for `Intl` (dates, numbers). */
export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale];
}

type Messages = (typeof messages)["vi"];
export type MessageKey = keyof Messages;

/** Names of the `{placeholders}` in a message, read from its literal type. */
export type ParamNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | ParamNames<Rest>
  : never;

/** Placeholder names of the message `K`. */
export type ParamNamesOf<K extends MessageKey> = ParamNames<Messages[K]>;

/** A value that goes into a message: numbers are formatted for the locale, strings are kept. */
export type MessageValue = string | number;

export type MessageParams<K extends MessageKey> = { [N in ParamNamesOf<K>]: MessageValue };

/** Keys of messages without placeholders. */
export type PlainKey = {
  [K in MessageKey]: [ParamNames<Messages[K]>] extends [never] ? K : never;
}[MessageKey];

/** Keys of messages that take parameters. */
export type ParamKey = Exclude<MessageKey, PlainKey>;

type StripOther<K> = K extends `${infer Base}.other` ? Base : never;

/** `x` for the plural pair `x.one` / `x.other`. */
export type PluralBase = StripOther<MessageKey>;
type OtherKey<B extends PluralBase> = `${B}.other` & MessageKey;

/** Placeholders of a plural message besides the automatic `{count}`. */
export type PluralParams<B extends PluralBase> = Omit<MessageParams<OtherKey<B>>, "count">;

/** Message without placeholders. Messages with placeholders go through `format`. */
export function t(locale: Locale, key: PlainKey): string {
  return messages[locale][key];
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** Placeholder names of a template, first occurrence first, each once. */
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((match) => match[1]!))];
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/**
 * Number for the locale: `12.345,5` in Vietnamese, `12,345.5` in English. Four-digit numbers stay
 * ungrouped (`1000`, as Spanish and Polish do) so small balances read as plain digits; grouping
 * starts at five digits.
 */
export function formatNumber(locale: Locale, value: number): string {
  const grouped = Math.abs(value) >= 10_000;
  const cacheKey = `${locale}:${grouped}`;
  let formatter = numberFormats.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(localeTag(locale), { useGrouping: grouped });
    numberFormats.set(cacheKey, formatter);
  }
  return formatter.format(value);
}

/** `hh:mm` in the locale's clock (24 h in Vietnamese, 12 h in English); empty for an invalid date. */
export function formatTime(locale: Locale, date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function templateOf(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}

function valueText(locale: Locale, value: MessageValue): string {
  return typeof value === "number" ? formatNumber(locale, value) : value;
}

function fill(
  locale: Locale,
  key: string,
  template: string,
  params: Readonly<Record<string, MessageValue | undefined>>,
): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing parameter "${name}" for message "${key}"`);
    }
    return valueText(locale, value);
  });
}

/** A message with its `{placeholders}` filled in. A missing parameter throws. */
export function format<K extends ParamKey>(
  locale: Locale,
  key: K,
  params: MessageParams<K>,
): string {
  return fill(locale, key, templateOf(locale, key), params);
}

/**
 * The plural form of `<base>.one` / `<base>.other` for `count`, chosen by the locale's plural rules;
 * `{count}` is filled in automatically, other placeholders come from `params`.
 */
export function formatPlural<B extends PluralBase>(
  locale: Locale,
  base: B,
  count: number,
  params?: PluralParams<B>,
): string {
  const category = new Intl.PluralRules(localeTag(locale)).select(count);
  const key = `${base}.${category === "one" ? "one" : "other"}` as MessageKey;
  return fill(locale, key, templateOf(locale, key), { ...params, count });
}

export type TemplatePart = string | { param: string };

/**
 * A message split into text and placeholders, for callers that put elements (not just text) into a
 * sentence. The word order stays the template's.
 */
export function templateParts(locale: Locale, key: ParamKey): TemplatePart[] {
  const template = templateOf(locale, key);
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    if (match.index > last) parts.push(template.slice(last, match.index));
    parts.push({ param: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}

/** Every message key of a locale, so tests can check that the locales stay aligned. */
export function messageKeys(locale: Locale): string[] {
  return Object.keys(messages[locale]);
}

/** The raw template of `key`, or undefined; for tests and for looking up keys built at run time. */
export function rawMessage(locale: Locale, key: string): string | undefined {
  return (messages[locale] as Readonly<Record<string, string>>)[key];
}

/** True when `key` is a message without placeholders, so it can be shown through `t`. */
export function isPlainKey(key: string): key is PlainKey {
  const template = rawMessage("vi", key);
  return template !== undefined && placeholders(template).length === 0;
}
