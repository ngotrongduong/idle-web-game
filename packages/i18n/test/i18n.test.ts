import { describe, expect, it } from "vitest";
import { messageKeys, t } from "../src/index";

describe("i18n foundation", () => {
  it("keeps VI and EN keys aligned", () => {
    expect(t("vi", "nav.guild")).toBe("Hội Quán");
    expect(t("en", "nav.guild")).toBe("Guildhall");
    expect(messageKeys("en").sort()).toEqual(messageKeys("vi").sort());
  });

  it("names the buildings and their upgrade states in both locales", () => {
    expect(t("vi", "building.forge")).toBe("Lò Rèn");
    expect(t("en", "building.forge")).toBe("Forge");
    for (const block of ["max_level", "builder_busy", "gold", "materials"] as const) {
      expect(t("vi", `buildings.blocked.${block}`)).not.toBe("");
      expect(t("en", `buildings.blocked.${block}`)).not.toBe("");
    }
  });
});
