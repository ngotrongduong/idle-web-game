import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
  FoundationPlayerStateSchema,
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

  it("accepts a versioned upgrade-building intent", () => {
    expect(
      CommandEnvelopeSchema.safeParse({
        cmdId: "98a61d7b-9020-49f4-ac27-5d3a4c37c6a7",
        expectVersion: 0,
        command: { type: "upgrade_building", building: "hall" },
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown building and the retired instant hall upgrade", () => {
    const envelope = { cmdId: "98a61d7b-9020-49f4-ac27-5d3a4c37c6a7", expectVersion: 0 };
    expect(
      CommandEnvelopeSchema.safeParse({
        ...envelope,
        command: { type: "upgrade_building", building: "castle" },
      }).success,
    ).toBe(false);
    expect(
      CommandEnvelopeSchema.safeParse({ ...envelope, command: { type: "upgrade_hall" } }).success,
    ).toBe(false);
  });

  it("rejects client-supplied state inside a command", () => {
    const parsed = CommandEnvelopeSchema.safeParse({
      cmdId: "98a61d7b-9020-49f4-ac27-5d3a4c37c6a7",
      expectVersion: 0,
      command: {
        type: "upgrade_building",
        building: "forge",
        gold: 999999,
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("gold" in parsed.data.command).toBe(false);
    }
  });

  it("gives players stored before buildings a level 1 Forge and an idle builder", () => {
    const state = FoundationPlayerStateSchema.parse({
      id: "98a61d7b-9020-49f4-ac27-5d3a4c37c6a7",
      version: 3,
      gold: 10,
      hallLevel: 2,
    });
    expect(state).toMatchObject({ forgeLevel: 1, construction: null, clearedDungeonIds: [] });
  });
});
