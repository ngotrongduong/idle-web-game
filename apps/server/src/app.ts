import Fastify from "fastify";
import { HealthResponseSchema } from "@idle/api-contract";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () =>
    HealthResponseSchema.parse({
      ok: true,
      service: "server",
      version: "m0",
    }),
  );

  return app;
}
