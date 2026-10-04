import crypto, { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
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

  it("persists the Forge level and the running construction", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    expect(player).toMatchObject({ forgeLevel: 1, construction: null });

    const construction = {
      building: "forge" as const,
      targetLevel: 3,
      startedAt: "2026-10-05T00:00:00.000Z",
      completesAt: "2026-10-05T00:01:31.000Z",
    };
    await store.setPlayer({ ...player, version: 1, forgeLevel: 2, construction });
    expect(await store.getPlayer(player.id)).toEqual({
      ...player,
      version: 1,
      forgeLevel: 2,
      construction,
    });

    await store.setPlayer({ ...player, version: 2, forgeLevel: 3, construction: null });
    expect(await store.getPlayer(player.id)).toMatchObject({ forgeLevel: 3, construction: null });
  });

  it("backfills the Forge level from already enhanced items exactly once", async () => {
    const store = createStore();
    const fresh = await store.createGuest(sessionHash());
    const enhanced = await store.createGuest(sessionHash());
    const veteran = await store.createGuest(sessionHash());
    const item = {
      itemId: "bamboo_training_sword",
      slot: "weapon" as const,
      qualityBps: 10_000,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
    };
    await store.createItem(enhanced.id, { ...item, enhanceLevel: 1 });
    await store.createItem(veteran.id, { ...item, enhanceLevel: 2 });
    await store.createItem(veteran.id, { ...item, enhanceLevel: 5 });

    // Runs the backfill blocks of the real migration files as a first deploy would (markers
    // removed), then again as every later deploy does. Everything happens in a transaction that
    // is rolled back, so other tests keep their rows and the markers.
    const backfillBlock = (file: string, marker: string) => {
      const sql = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
      const block = /DO \$\$[\s\S]*?\$\$;/.exec(sql)?.[0];
      expect(block).toContain(marker);
      return block!;
    };
    const backfill = backfillBlock("0014_m1_buildings.sql", "0014_backfill_forge_level");
    // 0015 re-maps the Forge level to the caps of the 2026-10-05 balance pass (+5 needs level 8).
    const capsBackfill = backfillBlock("0015_m1_forge_caps.sql", "0015_forge_caps_backfill");

    const pool = new Pool({ connectionString: databaseUrl! });
    const client = await pool.connect();
    const forgeLevels = async () => {
      const result = await client.query<{ id: string; forge_level: number }>(
        "SELECT id, forge_level FROM players WHERE id = ANY($1::uuid[])",
        [[fresh.id, enhanced.id, veteran.id]],
      );
      const byId = new Map(result.rows.map((row) => [row.id, row.forge_level]));
      return [fresh.id, enhanced.id, veteran.id].map((id) => byId.get(id));
    };
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM data_migrations WHERE id IN ('0014_backfill_forge_level', '0015_forge_caps_backfill')",
      );
      await client.query(backfill);
      expect(await forgeLevels()).toEqual([1, 2, 5]);
      await client.query(capsBackfill);
      expect(await forgeLevels()).toEqual([1, 2, 8]);

      // A later deploy must not touch players again, even ones who enhanced since.
      await client.query("UPDATE player_items SET enhance_level = 5 WHERE player_id = $1", [
        enhanced.id,
      ]);
      await client.query(backfill);
      await client.query(capsBackfill);
      expect(await forgeLevels()).toEqual([1, 2, 8]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
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

  it("persists auto-sell inventory settings", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());

    expect(await store.getAutoSellSettings(player.id)).toEqual({
      enabled: false,
      maxQualityBps: 10_000,
    });

    await store.setAutoSellSettings(player.id, {
      enabled: true,
      maxQualityBps: 12_000,
    });

    expect(await store.getAutoSellSettings(player.id)).toEqual({
      enabled: true,
      maxQualityBps: 12_000,
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
      pendingMaterials: [{ materialId: "bamboo_fiber", qty: 3 }],
      cycleSamples: [{ gold: 8, exp: 5, kills: { normal: 1, elite: 0, boss: 0 } }],
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

    const accrued = {
      ...run,
      pendingMaterials: [
        { materialId: "bamboo_fiber", qty: 4 },
        { materialId: "promotion_seal_t1", qty: 1 },
      ],
    };
    await store.updateDungeonRun(player.id, accrued);
    expect(await store.listDungeonRuns(player.id)).toContainEqual(accrued);

    const stoppedAt = new Date().toISOString();
    const stopped = await store.stopDungeonRun(player.id, run.id, stoppedAt);
    expect(stopped).toMatchObject({
      id: run.id,
      status: "stopped",
      stoppedAt,
      pendingMaterials: accrued.pendingMaterials,
    });
  });

  it("persists inventory items and equipment state", async () => {
    const store = createStore();
    const player = await store.createGuest(sessionHash());
    const hero = await store.createHero(player.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });
    const item = await store.createItem(player.id, {
      itemId: "bamboo_training_sword",
      slot: "weapon",
      qualityBps: 10_000,
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
    });

    await store.setItem(player.id, { ...item, locked: true, equippedHeroId: hero.id });
    expect(await store.listItems(player.id)).toContainEqual({
      ...item,
      locked: true,
      equippedHeroId: hero.id,
    });

    expect(await store.deleteItem(player.id, item.id)).toBe(true);
    expect(await store.listItems(player.id)).toEqual([]);
  });
});
