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
      version: "m0.6b",
    });
  });
});
