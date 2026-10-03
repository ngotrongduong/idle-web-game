import { describe, expect, it } from "vitest";
import { t } from "../src/index";

describe("i18n foundation", () => {
  it("keeps VI and EN keys aligned", () => {
    expect(t("vi", "nav.guild")).toBe("Hội Quán");
    expect(t("en", "nav.guild")).toBe("Guildhall");
  });
});
