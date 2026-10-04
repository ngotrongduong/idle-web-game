import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";
import { InMemoryGameStore } from "../src/store.js";

const apps: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const store = new InMemoryGameStore();
  const app = buildServer({ store });
  apps.push(app);
  const guest = await app.inject({ method: "POST", url: "/api/v1/auth/guest" });
  const cookie = String(guest.headers["set-cookie"]).split(";")[0]!;
  const playerId = guest.json().state.id as string;
  let version = 0;

  async function send(command: Record<string, unknown>) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie },
      payload: { cmdId: randomUUID(), expectVersion: version, command },
    });
    if (response.statusCode === 200) version = response.json().version;
    return response;
  }

  return { store, app, cookie, playerId, send };
}

describe("heroes busy in a dungeon run", () => {
  it("cannot farm in two active runs by moving between team slots", async () => {
    const { store, playerId, send } = await setup();
    const hero = await store.createHero(playerId, {
      classId: "ward_squire",
      rarity: "common",
      level: 10,
      exp: 0,
    });

    expect((await send({ type: "set_team", slot: 1, heroIds: [hero.id] })).statusCode).toBe(200);
    expect(
      (await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 })).statusCode,
    ).toBe(200);
    expect((await send({ type: "set_team", slot: 1, heroIds: [] })).statusCode).toBe(200);
    expect((await send({ type: "set_team", slot: 2, heroIds: [hero.id] })).statusCode).toBe(200);

    const second = await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 2 });
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("HERO_BUSY");
    expect(
      (await store.listDungeonRuns(playerId)).filter((run) => run.status === "active"),
    ).toHaveLength(1);
  });

  it("cannot swap equipment on a hero whose snapshot is farming", async () => {
    const { store, playerId, send } = await setup();
    // Two parallel teams need Hall Lv3 (GDD §5.1).
    await store.setPlayer({ ...(await store.getPlayer(playerId))!, hallLevel: 3 });
    const [first, second] = await Promise.all([
      store.createHero(playerId, { classId: "ward_squire", rarity: "common", level: 5, exp: 0 }),
      store.createHero(playerId, { classId: "trail_archer", rarity: "common", level: 5, exp: 0 }),
    ]);
    const item = await store.createItem(playerId, {
      itemId: "bamboo_training_sword",
      slot: "weapon",
      qualityBps: 10_000,
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
    });

    expect(
      (await send({ type: "equip_item", itemInstanceId: item.id, heroId: first!.id })).statusCode,
    ).toBe(200);
    await send({ type: "set_team", slot: 1, heroIds: [first!.id] });
    expect(
      (await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 })).statusCode,
    ).toBe(200);

    const unequip = await send({ type: "unequip_item", itemInstanceId: item.id });
    expect(unequip.statusCode).toBe(409);
    expect(unequip.json().code).toBe("HERO_BUSY");

    await send({ type: "set_team", slot: 2, heroIds: [second!.id] });
    expect(
      (await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 2 })).statusCode,
    ).toBe(200);
    const spare = await store.createItem(playerId, {
      itemId: "bamboo_spear",
      slot: "weapon",
      qualityBps: 10_000,
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
    });
    const equipBusy = await send({
      type: "equip_item",
      itemInstanceId: spare.id,
      heroId: second!.id,
    });
    expect(equipBusy.statusCode).toBe(409);
    expect(equipBusy.json().code).toBe("HERO_BUSY");
  });

  it("must claim a stopped run's EXP before promoting", async () => {
    const { store, app, cookie, playerId, send } = await setup();
    const hero = await store.createHero(playerId, {
      classId: "ward_squire",
      rarity: "common",
      level: 10,
      exp: 0,
    });
    await store.setMaterialQuantity(playerId, "promotion_seal_t1", 1);
    await send({ type: "set_team", slot: 1, heroIds: [hero.id] });
    const start = await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 });
    const run = start.json().events[0].run;
    await store.updateDungeonRun(playerId, {
      ...run,
      lastAccruedAt: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
    });
    expect((await send({ type: "stop_dungeon", runId: run.id })).statusCode).toBe(200);

    const state = await app.inject({
      method: "GET",
      url: "/api/v1/promotion",
      headers: { cookie },
    });
    expect(state.json().heroes[0]).toMatchObject({ heroId: hero.id, busy: true });

    const early = await send({
      type: "promote_hero",
      heroId: hero.id,
      targetClassId: "iron_guard",
    });
    expect(early.statusCode).toBe(409);
    expect(early.json().code).toBe("HERO_BUSY");

    expect((await send({ type: "claim_dungeon_rewards", runId: run.id })).statusCode).toBe(200);
    const promoted = await send({
      type: "promote_hero",
      heroId: hero.id,
      targetClassId: "iron_guard",
    });
    expect(promoted.statusCode).toBe(200);
    expect(promoted.json().events[0].hero).toMatchObject({
      classId: "iron_guard",
      level: 1,
      exp: 0,
    });
  });
});
