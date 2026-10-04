import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { PostgresGameStore } from "../src/db/postgres-store.js";

const databaseUrl = process.env.DATABASE_URL;
const stores: PostgresGameStore[] = [];

function createStore(): PostgresGameStore {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Postgres integration tests");
  }
  const store = new PostgresGameStore(databaseUrl);
  stores.push(store);
  return store;
}

function sessionHash(): string {
  return randomBytes(32).toString("hex");
}

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

describe.skipIf(!databaseUrl)("PostgresGameStore", () => {
  it("persists guest sessions and player state", async () => {
    const store = createStore();
    const hash = sessionHash();
    const player = await store.createGuest(hash);

    expect(await store.findPlayerIdBySessionHash(hash)).toBe(player.id);
    expect(await store.getPlayer(player.id)).toEqual(player);

    await store.setPlayer({ ...player, gold: 777, version: 1 });
    expect(await store.getPlayer(player.id)).toMatchObject({
      id: player.id,
      gold: 777,
      version: 1,
    });
  });

  it("persists idempotency outcomes", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const outcome = {
      statusCode: 200,
      body: { ok: true, version: 1 },
    };

    await store.setCommandOutcome(player.id, "cmd-postgres-1", outcome);
    expect(
      await store.getCommandOutcome(player.id, "cmd-postgres-1"),
    ).toEqual(outcome);
  });

  it("serializes updates with a real player row lock", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());

    const incrementGold = () =>
      store.withPlayerLock(player.id, async () => {
        const current = await store.getPlayer(player.id);
        if (!current) throw new Error("player missing during lock test");

        await new Promise((resolve) => setTimeout(resolve, 15));
        await store.setPlayer({
          ...current,
          version: current.version + 1,
          gold: current.gold + 1,
        });
      });

    await Promise.all([incrementGold(), incrementGold()]);

    expect(await store.getPlayer(player.id)).toMatchObject({
      version: 2,
      gold: 1_002,
    });
  });
});
