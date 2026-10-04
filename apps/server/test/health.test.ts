import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";

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
    });
    expect(body.materials.map((entry: { id: string }) => entry.id)).toContain("promotion_seal_t1");
    expect(body.classes.length).toBeGreaterThan(0);
  });
});
