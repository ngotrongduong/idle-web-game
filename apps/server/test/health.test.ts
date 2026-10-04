import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";
import { createConfiguredGameStore } from "../src/store-factory.js";
import { InMemoryGameStore } from "../src/store.js";

const app = buildServer();

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("returns the shared API contract", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "server",
      version: "m1.2",
    });
  });
});

describe("GET /api/v1/catalog", () => {
  it("serves localized display names without a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/catalog" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.dungeons).toContainEqual({
      id: "bamboo_grove",
      nameVi: "Rừng Gai Thornwood",
      nameEn: "Thornwood Forest",
      recommendedLevel: 1,
      unlockAfterDungeonId: null,
    });
    expect(body.dungeons[1]).toMatchObject({ unlockAfterDungeonId: "bamboo_grove" });
    expect(body.hall[0]).toEqual({
      level: 1,
      heroCapacity: 4,
      teamLimit: 1,
      upgradeGoldCost: 300,
    });
    expect(body.hall.map((level: { teamLimit: number }) => level.teamLimit)).toEqual([
      1, 1, 2, 2, 2, 3, 3, 3, 4, 4,
    ]);
    expect(body.materials.map((entry: { id: string }) => entry.id)).toContain("promotion_seal_t1");
    expect(body.classes.length).toBeGreaterThan(0);
  });
});

describe("request hardening", () => {
  it("treats a malformed session cookie as unauthenticated instead of a 500", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/state",
      headers: { cookie: "guildhall_session=%E0%A4%A" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("refuses to start in production without a database", () => {
    expect(() => createConfiguredGameStore({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
    expect(createConfiguredGameStore({ NODE_ENV: "test" })).toBeInstanceOf(InMemoryGameStore);
  });
});
