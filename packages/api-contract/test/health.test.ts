import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "../src/index";

describe("HealthResponseSchema", () => {
  it("rejects malformed health payloads", () => {
    expect(
      HealthResponseSchema.safeParse({ ok: false, service: "server", version: "m0" }).success,
    ).toBe(false);
  });
});
