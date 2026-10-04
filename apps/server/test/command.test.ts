import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { foundationGameData, lootConfig } from "@idle/game-data";
import { applyHeroExperience, rollIdleCycleLoot } from "@idle/game-core";
import { buildServer } from "../src/app.js";
import { dungeonRunKills, materialCountsToBalances } from "../src/idle.js";
import { InMemoryGameStore } from "../src/store.js";

const apps: ReturnType<typeof buildServer>[] = [];

function createApp() {
  const app = buildServer();
  apps.push(app);
  return app;
}

async function createGuest(app: ReturnType<typeof buildServer>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/guest",
  });
  expect(response.statusCode).toBe(200);

  const setCookie = response.headers["set-cookie"];
  expect(typeof setCookie).toBe("string");
  const cookie = String(setCookie).split(";")[0]!;

  return {
    cookie,
    state: response.json().state as {
      id: string;
      version: number;
      gold: number;
      hallLevel: number;
    },
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("server-authoritative command pipeline", () => {
  it("requires a session for player state", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/state",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("creates a guest and upgrades the hall by intent", async () => {
    const app = createApp();
    const guest = await createGuest(app);

    expect(guest.state).toMatchObject({
      version: 0,
      gold: 1000,
      hallLevel: 1,
    });

    const command = {
      cmdId: randomUUID(),
      expectVersion: 0,
      command: { type: "upgrade_hall" },
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: command,
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      ok: true,
      version: 1,
      patch: { gold: 700, hallLevel: 2 },
    });

    const retry = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: command,
    });

    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
  });

  it("refreshes the tavern, recruits a hero and enforces cooldown", async () => {
    const app = createApp();
    const guest = await createGuest(app);

    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "refresh_tavern" },
      },
    });

    expect(refresh.statusCode).toBe(200);
    const refreshBody = refresh.json();
    expect(refreshBody.version).toBe(1);
    const offers = refreshBody.events[0].tavern.offers as Array<{
      id: string;
      classId: string;
      rarity: string;
    }>;
    expect(offers).toHaveLength(3);

    const blockedRefresh = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: { type: "refresh_tavern" },
      },
    });
    expect(blockedRefresh.statusCode).toBe(409);
    expect(blockedRefresh.json().code).toBe("TAVERN_COOLDOWN");

    const recruit = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: {
          type: "recruit_hero",
          offerId: offers[0]!.id,
        },
      },
    });

    expect(recruit.statusCode).toBe(200);
    expect(recruit.json()).toMatchObject({
      ok: true,
      version: 2,
      events: [
        {
          type: "hero_recruited",
          hero: {
            classId: offers[0]!.classId,
            rarity: offers[0]!.rarity,
            level: 1,
            exp: 0,
          },
        },
      ],
    });

    const heroes = await app.inject({
      method: "GET",
      url: "/api/v1/heroes",
      headers: { cookie: guest.cookie },
    });
    expect(heroes.statusCode).toBe(200);
    expect(heroes.json().heroes).toHaveLength(1);

    const tavern = await app.inject({
      method: "GET",
      url: "/api/v1/tavern",
      headers: { cookie: guest.cookie },
    });
    expect(tavern.statusCode).toBe(200);
    expect(tavern.json().tavern.offers).toHaveLength(2);
  });

  it("serializes concurrent commands for the same player", async () => {
    const app = createApp();
    const guest = await createGuest(app);

    const makeCommand = () => ({
      cmdId: randomUUID(),
      expectVersion: 0,
      command: { type: "upgrade_hall" },
    });

    const [left, right] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/v1/cmd",
        headers: { cookie: guest.cookie },
        payload: makeCommand(),
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/cmd",
        headers: { cookie: guest.cookie },
        payload: makeCommand(),
      }),
    ]);

    expect([left.statusCode, right.statusCode].sort()).toEqual([200, 409]);

    const conflict = left.statusCode === 409 ? left : right;
    expect(conflict.json()).toMatchObject({
      code: "VERSION_CONFLICT",
      currentVersion: 1,
    });
  });
  it("persists team assignment and prevents one hero joining two teams", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);

    const heroA = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });
    const heroB = await store.createHero(guest.state.id, {
      classId: "trail_archer",
      rarity: "common",
      level: 1,
      exp: 0,
    });

    const setTeam = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: {
          type: "set_team",
          slot: 1,
          heroIds: [heroA.id, heroB.id],
        },
      },
    });

    expect(setTeam.statusCode).toBe(200);
    expect(setTeam.json()).toMatchObject({
      ok: true,
      version: 1,
      events: [
        {
          type: "team_updated",
          team: { slot: 1, heroIds: [heroA.id, heroB.id] },
        },
      ],
    });

    const teams = await app.inject({
      method: "GET",
      url: "/api/v1/teams",
      headers: { cookie: guest.cookie },
    });
    expect(teams.json()).toMatchObject({
      ok: true,
      teams: [{ slot: 1, heroIds: [heroA.id, heroB.id] }],
    });

    const reuseHero = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: {
          type: "set_team",
          slot: 2,
          heroIds: [heroA.id],
        },
      },
    });
    expect(reuseHero.statusCode).toBe(409);
    expect(reuseHero.json().code).toBe("TEAM_HERO_ALREADY_ASSIGNED");
  });
  it("accrues idle dungeon cycles and claims gold plus EXP exactly once", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);

    const hero = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });
    await store.setTeam(guest.state.id, {
      slot: 1,
      heroIds: [hero.id],
    });

    const start = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: {
          type: "start_dungeon",
          dungeonId: "bamboo_grove",
          teamSlot: 1,
        },
      },
    });
    expect(start.statusCode).toBe(200);

    const run = start.json().events[0].run;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1_000).toISOString();
    await store.updateDungeonRun(guest.state.id, {
      ...run,
      lastAccruedAt: tenMinutesAgo,
    });

    const goldPerCycle = run.waves.reduce(
      (sum: number, wave: { rewardGold: number }) => sum + wave.rewardGold,
      0,
    );
    const expPerCycle = run.waves.reduce(
      (sum: number, wave: { rewardExp: number }) => sum + wave.rewardExp,
      0,
    );

    const claim = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: {
          type: "claim_dungeon_rewards",
          runId: run.id,
        },
      },
    });

    expect(claim.statusCode).toBe(200);
    expect(claim.json()).toMatchObject({
      ok: true,
      version: 2,
      patch: { gold: 1_000 + goldPerCycle * 9 },
      events: [
        {
          type: "dungeon_rewards_claimed",
          runId: run.id,
          cycles: 9,
          gold: goldPerCycle * 9,
          expPerHero: expPerCycle * 9,
          heroIds: [hero.id],
        },
      ],
    });

    const heroClass = foundationGameData.classes.find((entry) => entry.id === hero.classId)!;
    const expectedProgress = applyHeroExperience(
      {
        level: hero.level,
        exp: hero.exp,
        tier: heroClass.tier,
      },
      expPerCycle * 9,
    );
    expect(await store.listHeroes(guest.state.id)).toContainEqual({
      ...hero,
      level: expectedProgress.level,
      exp: expectedProgress.exp,
    });

    const [claimedRun] = await store.listDungeonRuns(guest.state.id);
    expect(claimedRun).toMatchObject({
      pendingCycles: 0,
      pendingGold: 0,
      pendingExpPerHero: 0,
      completedCycles: 9,
    });

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 2,
        command: {
          type: "claim_dungeon_rewards",
          runId: run.id,
        },
      },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe("DUNGEON_REWARDS_EMPTY");
  });

  it("rolls deterministic boss loot into the material inventory on claim", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);

    const heroes = await Promise.all(
      Array.from({ length: 4 }, () =>
        store.createHero(guest.state.id, {
          classId: "ward_squire",
          rarity: "common",
          level: 10,
          exp: 0,
        }),
      ),
    );
    await store.setTeam(guest.state.id, { slot: 1, heroIds: heroes.map((hero) => hero.id) });
    await store.setMaterialQuantity(guest.state.id, "bamboo_fiber", 5);

    const start = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 },
      },
    });
    expect(start.statusCode).toBe(200);
    const run = start.json().events[0].run;
    expect(run.pendingMaterials).toEqual([]);
    expect(run.waves.every((wave: { result: string }) => wave.result === "win")).toBe(true);

    // Pin the seed so the expected drops (and at least one boss seal) are fixed for this test.
    await store.updateDungeonRun(guest.state.id, {
      ...run,
      seed: 123,
      lastAccruedAt: new Date(Date.now() - 4 * 60 * 60 * 1_000).toISOString(),
    });
    const expected = materialCountsToBalances(
      rollIdleCycleLoot({
        runSeed: 123,
        firstCycleIndex: 0,
        cycles: 225,
        kills: dungeonRunKills(run),
        rules: lootConfig.rules,
      }),
    );
    expect(expected.find((entry) => entry.materialId === "promotion_seal_t1")?.qty).toBeGreaterThan(
      0,
    );

    const runs = await app.inject({
      method: "GET",
      url: "/api/v1/dungeon-runs",
      headers: { cookie: guest.cookie },
    });
    expect(runs.json().runs[0]).toMatchObject({ pendingCycles: 225, pendingMaterials: expected });

    const claim = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: { type: "claim_dungeon_rewards", runId: run.id },
      },
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.json().events[0]).toMatchObject({
      type: "dungeon_rewards_claimed",
      cycles: 225,
      materials: expected,
    });

    const inventory = await store.listMaterials(guest.state.id);
    for (const entry of expected) {
      const bonus = entry.materialId === "bamboo_fiber" ? 5 : 0;
      expect(inventory).toContainEqual({ materialId: entry.materialId, qty: entry.qty + bonus });
    }
    const [claimedRun] = await store.listDungeonRuns(guest.state.id);
    expect(claimedRun).toMatchObject({ pendingMaterials: [], completedCycles: 225 });
  });

  it("promotes a capped hero down a direct branch with seal, gold and retained potential", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);

    const hero = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 10,
      exp: 0,
    });
    await store.setMaterialQuantity(guest.state.id, "promotion_seal_t1", 1);

    const promote = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: {
          type: "promote_hero",
          heroId: hero.id,
          targetClassId: "iron_guard",
        },
      },
    });

    expect(promote.statusCode).toBe(200);
    expect(promote.json()).toMatchObject({
      ok: true,
      version: 1,
      patch: { gold: 500 },
      events: [
        {
          type: "hero_promoted",
          fromClassId: "ward_squire",
          toClassId: "iron_guard",
          hero: {
            id: hero.id,
            classId: "iron_guard",
            level: 1,
            exp: 0,
            potential: { hp: 100, attack: 16, defense: 15, speed: 4 },
          },
        },
      ],
    });
    expect(await store.listMaterials(guest.state.id)).toContainEqual({
      materialId: "promotion_seal_t1",
      qty: 0,
    });
    expect(await store.getPlayer(guest.state.id)).toMatchObject({ version: 1, gold: 500 });
  });

  it("rejects invalid or underfunded promotion before spending resources", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);
    const hero = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 9,
      exp: 0,
    });

    const notCapped = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "promote_hero", heroId: hero.id, targetClassId: "iron_guard" },
      },
    });
    expect(notCapped.statusCode).toBe(409);
    expect(notCapped.json().code).toBe("HERO_NOT_AT_LEVEL_CAP");

    await store.setHero(guest.state.id, { ...hero, level: 10 });
    const invalidBranch = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "promote_hero", heroId: hero.id, targetClassId: "gale_marksman" },
      },
    });
    expect(invalidBranch.statusCode).toBe(409);
    expect(invalidBranch.json().code).toBe("HERO_PROMOTION_INVALID_BRANCH");

    const noSeal = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "promote_hero", heroId: hero.id, targetClassId: "blade_runner" },
      },
    });
    expect(noSeal.statusCode).toBe(409);
    expect(noSeal.json().code).toBe("INSUFFICIENT_MATERIAL");
    expect(await store.getPlayer(guest.state.id)).toMatchObject({ version: 0, gold: 1_000 });
  });

  it("blocks promotion while an active dungeon run contains the hero snapshot", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);
    const hero = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 10,
      exp: 0,
    });
    await store.setTeam(guest.state.id, { slot: 1, heroIds: [hero.id] });
    await store.setMaterialQuantity(guest.state.id, "promotion_seal_t1", 1);

    const start = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 },
      },
    });
    expect(start.statusCode).toBe(200);

    const promote = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: { type: "promote_hero", heroId: hero.id, targetClassId: "iron_guard" },
      },
    });
    expect(promote.statusCode).toBe(409);
    expect(promote.json().code).toBe("HERO_BUSY");
  });

  it("starts and stops a replay-safe six-wave dungeon run", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);

    const hero = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });
    await store.setTeam(guest.state.id, {
      slot: 1,
      heroIds: [hero.id],
    });

    const start = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: {
          type: "start_dungeon",
          dungeonId: "bamboo_grove",
          teamSlot: 1,
        },
      },
    });

    expect(start.statusCode).toBe(200);
    const run = start.json().events[0].run;
    expect(run).toMatchObject({
      dungeonId: "bamboo_grove",
      teamSlot: 1,
      status: "active",
    });
    expect(run.waves).toHaveLength(6);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/dungeon-runs",
      headers: { cookie: guest.cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().runs).toHaveLength(1);

    const stop = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: {
          type: "stop_dungeon",
          runId: run.id,
        },
      },
    });

    expect(stop.statusCode).toBe(200);
    expect(stop.json().events[0].run.status).toBe("stopped");
    expect(stop.json().events[0].run.stoppedAt).toBeTruthy();
  });

  it("equips, locks, unequips and sells inventory items without duplication", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);
    const hero = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });
    const first = await store.createItem(guest.state.id, {
      itemId: "bamboo_training_sword",
      slot: "weapon",
      qualityBps: 10_000,
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
    });
    const second = await store.createItem(guest.state.id, {
      itemId: "bamboo_spear",
      slot: "weapon",
      qualityBps: 10_000,
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
    });

    const equipFirst = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "equip_item", itemInstanceId: first.id, heroId: hero.id },
      },
    });
    expect(equipFirst.statusCode).toBe(200);

    const equipSecond = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: { type: "equip_item", itemInstanceId: second.id, heroId: hero.id },
      },
    });
    expect(equipSecond.statusCode).toBe(200);
    const afterSwap = await store.listItems(guest.state.id);
    expect(afterSwap.find((item) => item.id === first.id)?.equippedHeroId).toBeNull();
    expect(afterSwap.find((item) => item.id === second.id)?.equippedHeroId).toBe(hero.id);

    const lock = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 2,
        command: { type: "set_item_locked", itemInstanceId: first.id, locked: true },
      },
    });
    expect(lock.statusCode).toBe(200);

    const blockedSell = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 3,
        command: { type: "sell_item", itemInstanceId: first.id },
      },
    });
    expect(blockedSell.statusCode).toBe(409);
    expect(blockedSell.json().code).toBe("ITEM_LOCKED");

    await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 3,
        command: { type: "set_item_locked", itemInstanceId: first.id, locked: false },
      },
    });
    const sell = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 4,
        command: { type: "sell_item", itemInstanceId: first.id },
      },
    });
    expect(sell.statusCode).toBe(200);
    expect((await store.listItems(guest.state.id)).map((item) => item.id)).toEqual([second.id]);
  });

  it("applies equipped item stats only to new dungeon snapshots", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);
    const hero = await store.createHero(guest.state.id, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });
    await store.setTeam(guest.state.id, { slot: 1, heroIds: [hero.id] });
    const item = await store.createItem(guest.state.id, {
      itemId: "bamboo_training_sword",
      slot: "weapon",
      qualityBps: 10_000,
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: hero.id,
    });

    const start = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 },
      },
    });
    expect(start.statusCode).toBe(200);
    const run = start.json().events[0].run;
    expect(run.waves[0].allies[0].attack).toBeGreaterThan(20);

    const listed = await store.listItems(guest.state.id);
    expect(listed.find((entry) => entry.id === item.id)?.equippedHeroId).toBe(hero.id);
  });
  it("persists auto-sell settings and immediately sells matching crafted items", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);
    await store.setMaterialQuantity(guest.state.id, "bamboo_fiber", 10);
    await store.setMaterialQuantity(guest.state.id, "river_stone", 10);

    const settings = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "set_auto_sell", enabled: true, maxQualityBps: 13_000 },
      },
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({
      version: 1,
      events: [
        {
          type: "auto_sell_settings_updated",
          autoSell: { enabled: true, maxQualityBps: 13_000 },
        },
      ],
    });

    const craft = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: { type: "craft_item", itemId: "bamboo_training_sword" },
      },
    });
    expect(craft.statusCode).toBe(200);
    expect(craft.json().events.map((event: { type: string }) => event.type)).toEqual([
      "item_crafted",
      "item_auto_sold",
    ]);
    const autoSold = craft.json().events[1];
    expect(autoSold.gold).toBeGreaterThan(0);
    expect(await store.listItems(guest.state.id)).toEqual([]);
    expect(await store.getPlayer(guest.state.id)).toMatchObject({
      version: 2,
      gold: 1_000 + autoSold.gold,
    });

    const readSettings = await app.inject({
      method: "GET",
      url: "/api/v1/inventory-settings",
      headers: { cookie: guest.cookie },
    });
    expect(readSettings.statusCode).toBe(200);
    expect(readSettings.json()).toEqual({
      ok: true,
      autoSell: { enabled: true, maxQualityBps: 13_000 },
    });
  });

  it("crafts from recipe materials and enhances with persisted pity state", async () => {
    const store = new InMemoryGameStore();
    const app = buildServer({ store });
    apps.push(app);
    const guest = await createGuest(app);
    await store.setMaterialQuantity(guest.state.id, "bamboo_fiber", 10);
    await store.setMaterialQuantity(guest.state.id, "river_stone", 10);

    const craft = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 0,
        command: { type: "craft_item", itemId: "bamboo_training_sword" },
      },
    });

    expect(craft.statusCode).toBe(200);
    const crafted = craft.json().events[0].item;
    expect(crafted).toMatchObject({
      itemId: "bamboo_training_sword",
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
    });
    expect(crafted.qualityBps).toBeGreaterThanOrEqual(10_000);
    expect(crafted.qualityBps).toBeLessThanOrEqual(13_000);

    const balances = new Map(
      (await store.listMaterials(guest.state.id)).map((entry) => [entry.materialId, entry.qty]),
    );
    expect(balances.get("bamboo_fiber")).toBe(7);
    expect(balances.get("river_stone")).toBe(9);

    const enhance = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie: guest.cookie },
      payload: {
        cmdId: randomUUID(),
        expectVersion: 1,
        command: { type: "enhance_item", itemInstanceId: crafted.id },
      },
    });

    expect(enhance.statusCode).toBe(200);
    expect(enhance.json()).toMatchObject({
      ok: true,
      version: 2,
      patch: { gold: 900 },
      events: [
        {
          type: "item_enhanced",
          success: true,
          beforeLevel: 0,
          targetLevel: 1,
          goldCost: 100,
          item: { enhanceLevel: 1, enhancePityFailures: 0 },
        },
      ],
    });
  });
});
