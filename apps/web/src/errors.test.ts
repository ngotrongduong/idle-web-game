import { describe, expect, it } from "vitest";
import { ApiErrorCodeSchema } from "@idle/api-contract";
import { LOCALES, messageKeys, rawMessage, t } from "@idle/i18n";
import { NoticeError, errorMessageKey, noticeKey } from "./errors";

const CODES = ApiErrorCodeSchema.options;

describe("API error messages", () => {
  it("has a player-facing message in both languages for every contract error code", () => {
    expect(CODES.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      for (const code of CODES) {
        const message = rawMessage(locale, `error.${code}`);
        expect(message, `error.${code} in ${locale}`).toBeTypeOf("string");
        expect(message?.trim(), `error.${code} in ${locale}`).not.toBe("");
      }
    }
  });

  it("has no message for a code that the contract no longer has", () => {
    const known = new Set<string>(CODES);
    const stale = messageKeys("vi")
      .filter((key) => key.startsWith("error.") && key !== "error.generic")
      .filter((key) => !known.has(key.slice("error.".length)));
    expect(stale).toEqual([]);
  });

  it("looks the message up by code", () => {
    for (const code of CODES) {
      expect(errorMessageKey(code)).toBe(`error.${code}`);
    }
    expect(t("en", errorMessageKey("TAVERN_COOLDOWN"))).toBe(
      "The free refresh is not ready yet. Come back later.",
    );
    expect(t("vi", errorMessageKey("TAVERN_COOLDOWN"))).toBe(
      "Chưa đến lúc làm mới miễn phí. Hãy quay lại sau.",
    );
  });

  it("shows a generic message for a code it does not know", () => {
    for (const code of ["SOMETHING_NEW", "", "generic", "toString", "__proto__"]) {
      expect(errorMessageKey(code)).toBe("error.generic");
    }
    expect(t("en", "error.generic")).not.toBe("");
    expect(t("vi", "error.generic")).not.toBe("");
  });

  it("never shows the English text of the server's message", () => {
    // The messages the server sends are English sentences for logs.
    for (const serverMessage of [
      "Not enough gold to upgrade the building",
      "A valid session is required",
    ]) {
      for (const code of CODES) {
        expect(t("vi", errorMessageKey(code))).not.toBe(serverMessage);
      }
    }
  });
});

describe("notices", () => {
  it("keeps the message key of an error that is shown to the player", () => {
    expect(noticeKey(new NoticeError("app.loadError"))).toBe("app.loadError");
    expect(noticeKey(new NoticeError(errorMessageKey("HERO_BUSY")))).toBe("error.HERO_BUSY");
  });

  it("reports a dropped connection as such and anything else as a generic error", () => {
    expect(noticeKey(new TypeError("Failed to fetch"))).toBe("app.connectError");
    expect(noticeKey(new SyntaxError("Unexpected end of JSON input"))).toBe("error.generic");
    expect(noticeKey(new Error("boom"))).toBe("error.generic");
    expect(noticeKey("a string")).toBe("error.generic");
    expect(noticeKey(undefined)).toBe("error.generic");
  });
});
