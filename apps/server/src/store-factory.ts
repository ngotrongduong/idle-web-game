import { PostgresGameStore } from "./db/postgres-store.js";
import { InMemoryGameStore, type GameStore } from "./store.js";

export function createConfiguredGameStore(environment: NodeJS.ProcessEnv = process.env): GameStore {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (databaseUrl) return new PostgresGameStore(databaseUrl);
  if (environment.NODE_ENV === "production") {
    // The in-memory store loses every player on restart; never fall back to it silently.
    throw new Error("DATABASE_URL is required when NODE_ENV=production");
  }
  return new InMemoryGameStore();
}
