import { DEFAULT_LOCALE, isLocale, type Locale } from "@idle/i18n";

/** Where the player's language choice is kept between visits. */
export const LOCALE_STORAGE_KEY = "guildhall.locale";

export type LocaleStorage = Pick<Storage, "getItem" | "setItem">;

/** The browser's storage, or null when even reaching it throws (private mode, blocked storage). */
export function browserStorage(): LocaleStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The saved language. A missing, unknown or unreadable value gives Vietnamese: the browser's
 * language is deliberately not consulted (Vietnam is the launch market).
 */
export function readStoredLocale(storage: LocaleStorage | null = browserStorage()): Locale {
  try {
    const stored = storage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Saves the language; false when storage is unavailable (the choice then lasts for the session). */
export function storeLocale(
  locale: Locale,
  storage: LocaleStorage | null = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
