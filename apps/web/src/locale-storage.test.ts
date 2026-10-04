import { describe, expect, it } from "vitest";
import {
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  storeLocale,
  type LocaleStorage,
} from "./locale-storage";

function memoryStorage(initial: Record<string, string> = {}): LocaleStorage & {
  values: Record<string, string>;
} {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}

const brokenStorage: LocaleStorage = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("quota", "QuotaExceededError");
  },
};

describe("locale storage", () => {
  it("is saved under guildhall.locale", () => {
    expect(LOCALE_STORAGE_KEY).toBe("guildhall.locale");
  });

  it("starts in Vietnamese when nothing is saved", () => {
    expect(readStoredLocale(memoryStorage())).toBe("vi");
  });

  it("restores a saved language", () => {
    expect(readStoredLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: "en" }))).toBe("en");
    expect(readStoredLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: "vi" }))).toBe("vi");
  });

  it("falls back to Vietnamese for a value that is not a supported language", () => {
    for (const value of ["fr", "EN", "en-US", "", "null", "undefined", " en"]) {
      expect(readStoredLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: value }))).toBe("vi");
    }
  });

  it("falls back to Vietnamese when storage cannot be read or does not exist", () => {
    expect(readStoredLocale(brokenStorage)).toBe("vi");
    expect(readStoredLocale(null)).toBe("vi");
  });

  it("does not look at the browser language", () => {
    // Under Node there is no `window`, so the default storage is unreachable: still Vietnamese,
    // even where the platform language is English.
    expect(readStoredLocale()).toBe("vi");
  });

  it("saves the choice and reports whether it could", () => {
    const storage = memoryStorage();
    expect(storeLocale("en", storage)).toBe(true);
    expect(storage.values[LOCALE_STORAGE_KEY]).toBe("en");
    expect(readStoredLocale(storage)).toBe("en");
    expect(storeLocale("vi", storage)).toBe(true);
    expect(readStoredLocale(storage)).toBe("vi");
  });

  it("keeps working when saving is not possible", () => {
    expect(storeLocale("en", brokenStorage)).toBe(false);
    expect(storeLocale("en", null)).toBe(false);
    expect(storeLocale("en")).toBe(false);
  });
});
