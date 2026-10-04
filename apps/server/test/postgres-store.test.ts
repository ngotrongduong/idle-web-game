import crypto, { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
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

  it("rejects expired sessions", async () => {
    const store = createStore();
    const hash = sessionHash();
    await store.createGuest(hash);
    const pool = new Pool({ connectionString: databaseUrl! });

    try {
      await pool.query(
        "UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE session_hash = $1",
        [hash],
      );
      expect(await store.findPlayerIdBySessionHash(hash)).toBeUndefined();
    } finally {
      await pool.end();
    }
  });

  it("persists idempotency outcomes", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const outcome = {
      statusCode: 200,
      body: { ok: true, version: 1 },
    };

    await store.setCommandOutcome(player.id, "cmd-postgres-1", outcome);
    expect(await store.getCommandOutcome(player.id, "cmd-postgres-1")).toEqual(outcome);
  });

  it("expires and prunes idempotency outcomes after 24 hours", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const cmdId = `cmd-expired-${randomBytes(8).toString("hex")}`;
    await store.setCommandOutcome(player.id, cmdId, {
      statusCode: 200,
      body: { ok: true },
    });

    const pool = new Pool({ connectionString: databaseUrl! });
    try {
      await pool.query(
        "UPDATE command_outcomes SET created_at = now() - interval '25 hours' WHERE player_id = $1 AND cmd_id = $2",
        [player.id, cmdId],
      );

      expect(await store.getCommandOutcome(player.id, cmdId)).toBeUndefined();

      const result = await pool.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM command_outcomes WHERE player_id = $1 AND cmd_id = $2",
        [player.id, cmdId],
      );
      expect(result.rows[0]?.count).toBe(0);
    } finally {
      await pool.end();
    }
  });

  it("rolls back state changes when a locked task fails", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());

    await expect(
      store.withPlayerLock(player.id, async () => {
        await store.setPlayer({
          ...player,
          version: 1,
          gold: 1,
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    expect(await store.getPlayer(player.id)).toEqual(player);
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
  it("persists hero potential and material inventory", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const hero = await store.createHero(player.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
      potential: { hp: 10, attack: 2, defense: 1, speed: 0 },
    });

    expect(await store.listHeroes(player.id)).toContainEqual(hero);

    const promotedShape = {
      ...hero,
      classId: "iron_guard",
      level: 1,
      exp: 0,
      potential: { hp: 25, attack: 5, defense: 4, speed: 1 },
    };
    await store.setHero(player.id, promotedShape);
    expect(await store.listHeroes(player.id)).toContainEqual(promotedShape);

    await store.setMaterialQuantity(player.id, "promotion_seal_t1", 2);
    expect(await store.listMaterials(player.id)).toContainEqual({
      materialId: "promotion_seal_t1",
      qty: 2,
    });
  });

  it("persists team assignments", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const hero = await store.createHero(player.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });

    await store.setTeam(player.id, {
      slot: 1,
      heroIds: [hero.id],
    });

    expect(await store.listTeams(player.id)).toEqual([{ slot: 1, heroIds: [hero.id] }]);
  });

  it("persists tavern offers and recruited heroes", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const offerId = crypto.randomUUID();
    await store.setTavernState(player.id, {
      refreshesSinceRarePlus: 3,
      refreshesSinceLegendary: 7,
      nextFreeRefreshAt: new Date(Date.now() + 60_000),
      offers: [
        {
          id: offerId,
          classId: "ward_squire",
          rarity: "rare",
        },
      ],
    });

    expect(await store.getTavernState(player.id)).toMatchObject({
      refreshesSinceRarePlus: 3,
      refreshesSinceLegendary: 7,
      offers: [
        {
          id: offerId,
          classId: "ward_squire",
          rarity: "rare",
        },
      ],
    });

    const hero = await store.createHero(player.id, {
      classId: "ward_squire",
      rarity: "rare",
      level: 1,
      exp: 0,
    });

    expect(await store.listHeroes(player.id)).toContainEqual(hero);

    await store.setHeroProgress(player.id, [
      {
        id: hero.id,
        level: 2,
        exp: 7,
      },
    ]);
    expect(await store.listHeroes(player.id)).toContainEqual({
      ...hero,
      level: 2,
      exp: 7,
    });
  });
  it("persists and stops dungeon run snapshots", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const startedAt = new Date().toISOString();
    const run = await store.createDungeonRun(player.id, {
      dungeonId: "bamboo_grove",
      teamSlot: 1,
      seed: 123,
      battleRules: {
        maxTurns: 60,
        defenseK: 100,
        varianceMinBps: 9_000,
        varianceMaxBps: 11_000,
        defaultCritBps: 1_000,
        critMultiplierBps: 20_000,
        mpMax: 100,
        mpPerAction: 10,
        mpOnHit: 5,
        familyAdvantage: {},
        advantageMultiplierBps: 12_000,
        disadvantageMultiplierBps: 8_500,
      },
      status: "active",
      startedAt,
      stoppedAt: null,
      lastAccruedAt: startedAt,
      pendingCycles: 0,
      pendingGold: 0,
      pendingExpPerHero: 0,
      completedCycles: 0,
      waves: [
        {
          wave: 1,
          seed: 456,
          result: "win",
          turns: 2,
          hash: "1234abcd",
          allies: [
            {
              id: crypto.randomUUID(),
              hp: 100,
              attack: 20,
              defense: 10,
              speed: 5,
            },
          ],
          enemies: [
            {
              id: "bamboo_mite",
              hp: 85,
              attack: 22,
              defense: 7,
              speed: 11,
            },
          ],
          rewardGold: 8,
          rewardExp: 5,
        },
      ],
    });

    expect(await store.listDungeonRuns(player.id)).toContainEqual(run);

    const stoppedAt = new Date().toISOString();
    const stopped = await store.stopDungeonRun(player.id, run.id, stoppedAt);
    expect(stopped).toMatchObject({
      id: run.id,
      status: "stopped",
      stoppedAt,
    });
  });
});
