import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  format,
  formatNumber,
  formatPlural,
  formatTime,
  isLocale,
  isPlainKey,
  localeTag,
  messageKeys,
  placeholders,
  rawMessage,
  t,
  templateParts,
  type Locale,
  type ParamKey,
} from "../src/index";

function templates(locale: Locale): Array<[string, string]> {
  return messageKeys(locale).map((key) => [key, rawMessage(locale, key) ?? ""]);
}

describe("i18n foundation", () => {
  it("keeps VI and EN keys aligned", () => {
    expect(t("vi", "nav.guild")).toBe("Hội Quán");
    expect(t("en", "nav.guild")).toBe("Guildhall");
    expect(messageKeys("en").sort()).toEqual(messageKeys("vi").sort());
  });

  it("uses the same placeholders in both locales for every message", () => {
    for (const key of messageKeys("vi")) {
      const vi = placeholders(rawMessage("vi", key) ?? "").sort();
      const en = placeholders(rawMessage("en", key) ?? "").sort();
      expect({ key, placeholders: en }).toEqual({ key, placeholders: vi });
    }
  });

  it("has no empty message and no stray braces in either locale", () => {
    for (const locale of LOCALES) {
      for (const [key, template] of templates(locale)) {
        expect({ locale, key, empty: template.trim() === "" }).toEqual({
          locale,
          key,
          empty: false,
        });
        const withoutPlaceholders = template.replace(/\{\w+\}/g, "");
        expect({ locale, key, braces: /[{}]/.test(withoutPlaceholders) }).toEqual({
          locale,
          key,
          braces: false,
        });
      }
    }
  });

  it("defines both plural forms of every plural message in both locales", () => {
    const bases = messageKeys("vi")
      .filter((key) => key.endsWith(".other"))
      .map((key) => key.slice(0, -".other".length));
    expect(bases.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      for (const base of bases) {
        expect(rawMessage(locale, `${base}.one`), `${locale} ${base}.one`).toBeTypeOf("string");
        expect(rawMessage(locale, `${base}.other`), `${locale} ${base}.other`).toBeTypeOf("string");
        expect(placeholders(rawMessage(locale, `${base}.one`)!)).toEqual(
          placeholders(rawMessage(locale, `${base}.other`)!),
        );
      }
    }
  });

  it("names the buildings and their upgrade states in both locales", () => {
    expect(t("vi", "building.forge")).toBe("Lò Rèn");
    expect(t("en", "building.forge")).toBe("Forge");
    for (const block of ["max_level", "builder_busy", "gold", "materials"] as const) {
      expect(t("vi", `buildings.blocked.${block}`)).not.toBe("");
      expect(t("en", `buildings.blocked.${block}`)).not.toBe("");
    }
  });

  it("labels each language option in its own language whatever the current locale is", () => {
    for (const locale of LOCALES) {
      expect(t(locale, "locale.option.vi")).toBe("Tiếng Việt");
      expect(t(locale, "locale.option.en")).toBe("English");
    }
  });
});

describe("locales", () => {
  it("defaults to Vietnamese and recognises only the two supported locales", () => {
    expect(DEFAULT_LOCALE).toBe("vi");
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("en")).toBe(true);
    for (const value of ["fr", "VI", "", null, undefined, 1, {}]) {
      expect(isLocale(value)).toBe(false);
    }
    expect(localeTag("vi")).toBe("vi-VN");
    expect(localeTag("en")).toBe("en-US");
  });
});

describe("placeholders", () => {
  it("lists each placeholder once, in order of appearance", () => {
    expect(placeholders("{a} and {b} and {a}")).toEqual(["a", "b"]);
    expect(placeholders("no values")).toEqual([]);
  });

  it("fills them in, so each language can order the words its own way", () => {
    const params = { building: "X", level: 3 };
    expect(format("vi", "buildings.upgradingTo", params)).toBe("Đang nâng cấp: X → Cấp 3");
    expect(format("en", "buildings.upgradingTo", params)).toBe("Upgrading: X → Level 3");
    expect(format("vi", "equipment.sellValue", { gold: 12 })).toBe("Giá bán: 12 vàng");
    expect(format("en", "equipment.sellValue", { gold: 12 })).toBe("Sell value: 12 gold");
  });

  it("formats numbers for the locale and leaves strings alone", () => {
    expect(format("vi", "reward.gold", { gold: 12_345 })).toBe("+12.345 vàng");
    expect(format("en", "reward.gold", { gold: 12_345 })).toBe("+12,345 gold");
    expect(format("en", "dungeon.runMeta", { seed: "123456789", waves: "6 waves" })).toBe(
      "seed 123456789 · 6 waves",
    );
  });

  it("fails loudly when a parameter is missing", () => {
    const withoutParams = format as (locale: Locale, key: ParamKey, params: object) => string;
    expect(() => withoutParams("en", "equipment.dismantle", { dust: 2 })).toThrow(
      'Missing parameter "material" for message "equipment.dismantle"',
    );
    expect(() => withoutParams("vi", "common.labelValue", {})).toThrow(/Missing parameter/);
  });

  it("rejects wrong parameters at compile time", () => {
    // Never called: `tsc` checks that each line below is an error.
    const compileTimeOnly = () => {
      // @ts-expect-error `material` is missing
      format("en", "equipment.dismantle", { dust: 2 });
      // @ts-expect-error `colour` is not a placeholder of this message
      format("en", "equipment.sellValue", { gold: 1, colour: "red" });
      // @ts-expect-error messages with placeholders go through `format`
      t("en", "common.labelValue");
      // @ts-expect-error no such message
      t("en", "nav.nope");
    };
    expect(compileTimeOnly).toBeTypeOf("function");
  });

  it("splits a message into text and placeholders in the template's order", () => {
    expect(templateParts("vi", "common.labelValue")).toEqual([
      { param: "label" },
      ": ",
      { param: "value" },
    ]);
    expect(templateParts("en", "buildings.upgradingTo")).toEqual([
      "Upgrading: ",
      { param: "building" },
      " → Level ",
      { param: "level" },
    ]);
  });

  it("tells plain messages from messages that need parameters", () => {
    expect(isPlainKey("nav.guild")).toBe(true);
    expect(isPlainKey("common.labelValue")).toBe(false);
    expect(isPlainKey("no.such.key")).toBe(false);
  });
});

describe("plurals", () => {
  it("picks the English form from the count", () => {
    expect(formatPlural("en", "dungeon.cycles", 0)).toBe("0 cycles");
    expect(formatPlural("en", "dungeon.cycles", 1)).toBe("1 cycle");
    expect(formatPlural("en", "dungeon.cycles", 2)).toBe("2 cycles");
    expect(formatPlural("en", "dungeon.turns", 1)).toBe("1 turn");
    expect(formatPlural("en", "dungeon.waves", 1_500)).toBe("1500 waves");
  });

  it("has one Vietnamese form for every count", () => {
    expect(formatPlural("vi", "dungeon.cycles", 0)).toBe("0 cycle");
    expect(formatPlural("vi", "dungeon.cycles", 1)).toBe("1 cycle");
    expect(formatPlural("vi", "dungeon.turns", 2)).toBe("2 lượt");
  });
});

describe("numbers and times", () => {
  it("groups digits the way the locale does, from five digits", () => {
    expect(formatNumber("vi", 0)).toBe("0");
    expect(formatNumber("vi", 1_000)).toBe("1000");
    expect(formatNumber("vi", 9_999)).toBe("9999");
    expect(formatNumber("vi", 10_000)).toBe("10.000");
    expect(formatNumber("vi", 626_480)).toBe("626.480");
    expect(formatNumber("vi", 1_234_567)).toBe("1.234.567");
    expect(formatNumber("en", 1_000)).toBe("1000");
    expect(formatNumber("en", 626_480)).toBe("626,480");
    expect(formatNumber("en", 1_234_567)).toBe("1,234,567");
    expect(formatNumber("en", -12_345)).toBe("-12,345");
  });

  it("uses the locale's decimal separator", () => {
    expect(formatNumber("vi", 4.5)).toBe("4,5");
    expect(formatNumber("en", 4.5)).toBe("4.5");
    expect(format("vi", "common.percent", { value: 43.75 })).toBe("43,75%");
    expect(format("en", "common.percent", { value: 43.75 })).toBe("43.75%");
  });

  it("shows the clock the locale uses", () => {
    const afternoon = new Date(2026, 9, 5, 14, 5);
    const normalise = (text: string) => text.replace(/\s/g, " ");
    expect(formatTime("vi", afternoon)).toBe("14:05");
    expect(normalise(formatTime("en", afternoon))).toBe("02:05 PM");
    expect(formatTime("vi", new Date("not a date"))).toBe("");
  });
});
