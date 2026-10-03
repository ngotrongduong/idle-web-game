import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
  HealthResponseSchema,
} from "../src/index";

describe("API contracts", () => {
  it("rejects malformed health payloads", () => {
    expect(
      HealthResponseSchema.safeParse({
        ok: false,
        service: "server",
        version: "m0",
      }).success,
    ).toBe(false);
  });

  it("accepts a versioned upgrade-hall intent", () => {
    expect(
      CommandEnvelopeSchema.safeParse({
        cmdId: "98a61d7b-9020-49f4-ac27-5d3a4c37c6a7",
        expectVersion: 0,
        command: { type: "upgrade_hall" },
      }).success,
    ).toBe(true);
  });

  it("rejects client-supplied state inside a command", () => {
    const parsed = CommandEnvelopeSchema.safeParse({
      cmdId: "98a61d7b-9020-49f4-ac27-5d3a4c37c6a7",
      expectVersion: 0,
      command: {
        type: "upgrade_hall",
        gold: 999999,
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("gold" in parsed.data.command).toBe(false);
    }
  });
});
