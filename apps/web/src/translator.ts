import {
  format,
  formatNumber,
  formatPlural,
  formatTime,
  t,
  type Locale,
  type MessageParams,
  type ParamKey,
  type PlainKey,
  type PluralBase,
  type PluralParams,
} from "@idle/i18n";
import { localizedName, type NamedEntry } from "./catalog-names";

/** Separates the data points of one line ("12 gold · 3 EXP"); the same in every language. */
const LIST_SEPARATOR = " · ";

/** Joins already formatted parts of one line. */
export function joinParts(parts: readonly string[]): string {
  return parts.join(LIST_SEPARATOR);
}

/** `@idle/i18n` bound to one locale, so components do not pass the locale around. */
export type Translator = {
  locale: Locale;
  t(key: PlainKey): string;
  format<K extends ParamKey>(key: K, params: MessageParams<K>): string;
  plural<B extends PluralBase>(base: B, count: number, params?: PluralParams<B>): string;
  number(value: number): string;
  time(date: Date): string;
  /** A catalog entry's name in this locale. */
  name(entry: Pick<NamedEntry, "nameVi" | "nameEn">): string;
  /** Joins already formatted parts of one line. */
  list(parts: readonly string[]): string;
};

export function createTranslator(locale: Locale): Translator {
  return {
    locale,
    t: (key) => t(locale, key),
    format: (key, params) => format(locale, key, params),
    plural: (base, count, params) => formatPlural(locale, base, count, params),
    number: (value) => formatNumber(locale, value),
    time: (date) => formatTime(locale, date),
    name: (entry) => localizedName(entry, locale),
    list: joinParts,
  };
}
