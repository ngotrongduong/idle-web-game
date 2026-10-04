import { PostgresGameStore } from "./db/postgres-store.js";
import {
  InMemoryGameStore,
  type GameStore,
} from "./store.js";

export function createConfiguredGameStore(
  environment: NodeJS.ProcessEnv = process.env,
): GameStore {
  const databaseUrl = environment.DATABASE_URL?.trim();
  return databaseUrl
    ? new PostgresGameStore(databaseUrl)
    : new InMemoryGameStore();
}
