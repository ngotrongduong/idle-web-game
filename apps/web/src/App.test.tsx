import { describe, expect, it } from "vitest";
import { t } from "@idle/i18n";

describe("web foundation", () => {
  it("loads Vietnamese title from shared i18n package", () => {
    expect(t("vi", "app.title")).toBe("Project Guildhall");
  });
});
