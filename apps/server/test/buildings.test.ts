import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";
import { InMemoryGameStore } from "../src/store.js";

const apps: ReturnType<typeof buildServer>[] = [];
const START = Date.parse("2026-10-05T00:00:00.000Z");

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

/** A guest on a server whose clock only moves when the test calls `advance`. */
async function setup() {
  const store = new InMemoryGameStore();
  let nowMs = START;
  const app = buildServer({ store, now: () => new Date(nowMs) });
  apps.push(app);

  const auth = await app.inject({ method: "POST", url: "/api/v1/auth/guest" });
  const cookie = String(auth.headers["set-cookie"]).split(";")[0]!;
  const playerId = auth.json().state.id as string;

  const send = async (command: Record<string, unknown>, cmdId = randomUUID()) => {
    const player = (await store.getPlayer(playerId))!;
    return app.inject({
      method: "POST",
      url: "/api/v1/cmd",
      headers: { cookie },
      payload: { cmdId, expectVersion: player.version, command },
    });
  };
  const get = async (url: string) =>
    (await app.inject({ method: "GET", url, headers: { cookie } })).json();
  const patchPlayer = async (patch: Record<string, unknown>) =>
    store.setPlayer({ ...(await store.getPlayer(playerId))!, ...patch });
  const materialQty = async (materialId: string) =>
    (await store.listMaterials(playerId)).find((entry) => entry.materialId === materialId)?.qty ??
    0;
  const createItem = (overrides: Record<string, unknown> = {}) =>
    store.createItem(playerId, {
      itemId: "bamboo_training_sword",
      slot: "weapon",
      qualityBps: 10_000,
      enhanceLevel: 0,
      enhancePityFailures: 0,
      locked: false,
      equippedHeroId: null,
      ...overrides,
    });

  return {
    store,
    playerId,
    send,
    get,
    patchPlayer,
    materialQty,
    createItem,
    advance: (seconds: number) => {
      nowMs += seconds * 1_000;
    },
  };
}

describe("building upgrades run on a timer", () => {
  it("charges at once and applies the level only when the build time has passed", async () => {
    const game = await setup();

    const start = await game.send({ type: "upgrade_building", building: "hall" });
    expect(start.statusCode).toBe(200);
    expect(start.json()).toMatchObject({
      patch: { gold: 700, hallLevel: 1 },
      events: [
        {
          type: "building_upgrade_started",
          building: "hall",
          fromLevel: 1,
          toLevel: 2,
          goldCost: 300,
          consumedMaterials: [],
          construction: {
            startedAt: new Date(START).toISOString(),
            completesAt: new Date(START + 60_000).toISOString(),
          },
        },
      ],
    });

    game.advance(59);
    expect(await game.get("/api/v1/buildings")).toMatchObject({
      serverTime: new Date(START + 59_000).toISOString(),
      hallLevel: 1,
      construction: { building: "hall", targetLevel: 2 },
    });

    game.advance(1);
    expect(await game.get("/api/v1/buildings")).toMatchObject({ hallLevel: 2, construction: null });
    expect(await game.get("/api/v1/state")).toMatchObject({
      version: 1,
      hallLevel: 2,
      construction: null,
    });
  });

  it("lets the next command build on the finished level and persists it", async () => {
    const game = await setup();
    await game.patchPlayer({ gold: 5_000 });
    await game.send({ type: "upgrade_building", building: "hall" });
    game.advance(60);

    const next = await game.send({ type: "upgrade_building", building: "hall" });
    expect(next.statusCode).toBe(200);
    expect(next.json()).toMatchObject({
      patch: { gold: 5_000 - 300 - 780, hallLevel: 2 },
      events: [{ fromLevel: 2, toLevel: 3 }],
    });
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({
      hallLevel: 2,
      construction: { building: "hall", targetLevel: 3 },
    });
  });

  it("has a single builder: a second upgrade waits and costs nothing", async () => {
    const game = await setup();
    await game.store.setMaterialQuantity(game.playerId, "river_stone", 3);
    await game.send({ type: "upgrade_building", building: "hall" });

    const second = await game.send({ type: "upgrade_building", building: "forge" });
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("BUILDER_BUSY");
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({ version: 1, gold: 700 });
    expect(await game.materialQty("river_stone")).toBe(3);

    game.advance(60);
    const afterwards = await game.send({ type: "upgrade_building", building: "forge" });
    expect(afterwards.statusCode).toBe(200);
  });

  it("upgrades the Forge for gold plus dungeon materials", async () => {
    const game = await setup();

    const noMaterials = await game.send({ type: "upgrade_building", building: "forge" });
    expect(noMaterials.statusCode).toBe(409);
    expect(noMaterials.json().code).toBe("INSUFFICIENT_MATERIAL");
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({ version: 0, gold: 1_000 });

    await game.store.setMaterialQuantity(game.playerId, "river_stone", 5);
    const start = await game.send({ type: "upgrade_building", building: "forge" });
    expect(start.statusCode).toBe(200);
    expect(start.json()).toMatchObject({
      patch: { gold: 760, forgeLevel: 1 },
      events: [
        {
          building: "forge",
          goldCost: 240,
          consumedMaterials: [{ materialId: "river_stone", qty: 3 }],
        },
      ],
    });
    expect(await game.materialQty("river_stone")).toBe(2);

    game.advance(48);
    expect(await game.get("/api/v1/buildings")).toMatchObject({ forgeLevel: 2, hallLevel: 1 });
  });

  it("rejects an upgrade without enough gold or beyond the maximum level", async () => {
    const game = await setup();
    await game.patchPlayer({ gold: 299 });
    const poor = await game.send({ type: "upgrade_building", building: "hall" });
    expect(poor.json().code).toBe("INSUFFICIENT_GOLD");

    await game.patchPlayer({ gold: 1_000_000, hallLevel: 10 });
    const maxed = await game.send({ type: "upgrade_building", building: "hall" });
    expect(maxed.json().code).toBe("MAX_LEVEL");
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({
      version: 0,
      gold: 1_000_000,
      construction: null,
    });
  });

  it("does not start the same upgrade twice when the command is retried", async () => {
    const game = await setup();
    const cmdId = randomUUID();
    const first = await game.send({ type: "upgrade_building", building: "hall" }, cmdId);
    const retry = await game.send({ type: "upgrade_building", building: "hall" }, cmdId);

    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({ version: 1, gold: 700 });
  });
});

describe("speeding up a construction", () => {
  it("uses only the hourglasses the remaining time needs and finishes the build", async () => {
    const game = await setup();
    await game.store.setMaterialQuantity(game.playerId, "builders_hourglass", 5);
    await game.send({ type: "upgrade_building", building: "hall" });

    const speedUp = await game.send({ type: "speed_up_construction", items: 5 });
    expect(speedUp.statusCode).toBe(200);
    expect(speedUp.json()).toMatchObject({
      version: 2,
      patch: { hallLevel: 2, construction: null },
      events: [
        {
          type: "construction_sped_up",
          building: "hall",
          materialId: "builders_hourglass",
          itemsUsed: 1,
          completed: true,
          construction: null,
        },
      ],
    });
    expect(await game.materialQty("builders_hourglass")).toBe(4);
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({
      hallLevel: 2,
      construction: null,
    });

    const nothingToSpeedUp = await game.send({ type: "speed_up_construction", items: 1 });
    expect(nothingToSpeedUp.statusCode).toBe(409);
    expect(nothingToSpeedUp.json().code).toBe("NO_CONSTRUCTION");
    expect(await game.materialQty("builders_hourglass")).toBe(4);
  });

  it("shortens a long build by five minutes per hourglass", async () => {
    const game = await setup();
    await game.patchPlayer({ gold: 20_000, hallLevel: 5 });
    await game.store.setMaterialQuantity(game.playerId, "builders_hourglass", 2);
    await game.send({ type: "upgrade_building", building: "hall" });

    const speedUp = await game.send({ type: "speed_up_construction", items: 2 });
    expect(speedUp.json()).toMatchObject({
      patch: {
        hallLevel: 5,
        construction: { completesAt: new Date(START + (782 - 600) * 1_000).toISOString() },
      },
      events: [{ itemsUsed: 2, completed: false }],
    });
    expect(await game.materialQty("builders_hourglass")).toBe(0);

    const empty = await game.send({ type: "speed_up_construction", items: 1 });
    expect(empty.statusCode).toBe(409);
    expect(empty.json().code).toBe("INSUFFICIENT_MATERIAL");
  });

  it("spends the hourglass once when the command is retried", async () => {
    const game = await setup();
    await game.patchPlayer({ gold: 20_000, hallLevel: 5 });
    await game.store.setMaterialQuantity(game.playerId, "builders_hourglass", 2);
    await game.send({ type: "upgrade_building", building: "hall" });

    const cmdId = randomUUID();
    const first = await game.send({ type: "speed_up_construction", items: 1 }, cmdId);
    const retry = await game.send({ type: "speed_up_construction", items: 1 }, cmdId);
    expect(retry.json()).toEqual(first.json());
    expect(await game.materialQty("builders_hourglass")).toBe(1);
  });
});

describe("the Forge level gates enhancement and improves crafting", () => {
  it("locks enhancement at Forge level 1 without charging anything", async () => {
    const game = await setup();
    await game.store.setMaterialQuantity(game.playerId, "forge_dust", 10);
    const item = await game.createItem();

    const blocked = await game.send({ type: "enhance_item", itemInstanceId: item.id });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().code).toBe("FORGE_LEVEL_TOO_LOW");
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({ version: 0, gold: 1_000 });
    expect(await game.materialQty("forge_dust")).toBe(10);
  });

  it("allows +2 at Forge level 2 and one more level per Forge level", async () => {
    const game = await setup();
    await game.patchPlayer({ forgeLevel: 2, gold: 10_000 });
    await game.store.setMaterialQuantity(game.playerId, "forge_dust", 50);
    const atCap = await game.createItem({ enhanceLevel: 2 });

    const blocked = await game.send({ type: "enhance_item", itemInstanceId: atCap.id });
    expect(blocked.json().code).toBe("FORGE_LEVEL_TOO_LOW");

    await game.patchPlayer({ forgeLevel: 3 });
    const allowed = await game.send({ type: "enhance_item", itemInstanceId: atCap.id });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().events[0]).toMatchObject({ beforeLevel: 2, targetLevel: 3, dustCost: 3 });
    expect(await game.materialQty("forge_dust")).toBe(47);
  });

  it("needs Forge Dust for every attempt and keeps the gold when dust is missing", async () => {
    const game = await setup();
    await game.patchPlayer({ forgeLevel: 5 });
    const item = await game.createItem();

    const noDust = await game.send({ type: "enhance_item", itemInstanceId: item.id });
    expect(noDust.statusCode).toBe(409);
    expect(noDust.json().code).toBe("INSUFFICIENT_MATERIAL");
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({ version: 0, gold: 1_000 });
  });

  it("uses the finished Forge level for the next enhancement", async () => {
    const game = await setup();
    await game.store.setMaterialQuantity(game.playerId, "river_stone", 3);
    await game.store.setMaterialQuantity(game.playerId, "forge_dust", 1);
    const item = await game.createItem();
    await game.send({ type: "upgrade_building", building: "forge" });

    const tooEarly = await game.send({ type: "enhance_item", itemInstanceId: item.id });
    expect(tooEarly.json().code).toBe("FORGE_LEVEL_TOO_LOW");

    game.advance(48);
    const enhanced = await game.send({ type: "enhance_item", itemInstanceId: item.id });
    expect(enhanced.statusCode).toBe(200);
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({
      forgeLevel: 2,
      construction: null,
    });
  });

  it("crafts better quality at a high Forge level", async () => {
    const commonShare = async (forgeLevel: number) => {
      const game = await setup();
      const crafts = 400;
      await game.patchPlayer({ forgeLevel });
      await game.store.setMaterialQuantity(game.playerId, "bamboo_fiber", 3 * crafts);
      await game.store.setMaterialQuantity(game.playerId, "river_stone", crafts);

      let common = 0;
      for (let index = 0; index < crafts; index += 1) {
        const craft = await game.send({ type: "craft_item", itemId: "bamboo_training_sword" });
        if (craft.json().events[0].item.qualityBps === 10_000) common += 1;
      }
      return common / crafts;
    };

    // Configured odds of a Common roll: 70% at Forge level 1, 43% at level 10.
    expect(await commonShare(1)).toBeGreaterThan(0.565);
    expect(await commonShare(10)).toBeLessThan(0.565);
  });
});

describe("dismantling items into Forge Dust", () => {
  it("destroys the item and pays dust by quality", async () => {
    const game = await setup();
    const common = await game.createItem();
    const masterwork = await game.createItem({ qualityBps: 13_000, enhanceLevel: 3 });

    const first = await game.send({ type: "dismantle_item", itemInstanceId: common.id });
    expect(first.statusCode).toBe(200);
    expect(first.json().events).toEqual([
      { type: "item_dismantled", itemInstanceId: common.id, materialId: "forge_dust", dust: 1 },
    ]);

    const second = await game.send({ type: "dismantle_item", itemInstanceId: masterwork.id });
    expect(second.json().events[0]).toMatchObject({ dust: 5 });
    expect(await game.materialQty("forge_dust")).toBe(6);
    expect(await game.store.listItems(game.playerId)).toEqual([]);
    expect(await game.store.getPlayer(game.playerId)).toMatchObject({ version: 2, gold: 1_000 });
  });

  it("pays once: a retry returns the same result and a second command finds no item", async () => {
    const game = await setup();
    const item = await game.createItem();
    const cmdId = randomUUID();

    const first = await game.send({ type: "dismantle_item", itemInstanceId: item.id }, cmdId);
    const retry = await game.send({ type: "dismantle_item", itemInstanceId: item.id }, cmdId);
    expect(retry.json()).toEqual(first.json());

    const again = await game.send({ type: "dismantle_item", itemInstanceId: item.id });
    expect(again.statusCode).toBe(409);
    expect(again.json().code).toBe("ITEM_NOT_FOUND");
    expect(await game.materialQty("forge_dust")).toBe(1);
  });

  it("never dismantles a locked or equipped item", async () => {
    const game = await setup();
    const hero = await game.store.createHero(game.playerId, {
      classId: "ward_squire",
      rarity: "common",
      level: 1,
      exp: 0,
    });
    const locked = await game.createItem({ locked: true });
    const worn = await game.createItem({ equippedHeroId: hero.id });

    const lockedResult = await game.send({ type: "dismantle_item", itemInstanceId: locked.id });
    expect(lockedResult.json().code).toBe("ITEM_LOCKED");
    const wornResult = await game.send({ type: "dismantle_item", itemInstanceId: worn.id });
    expect(wornResult.json().code).toBe("ITEM_EQUIPPED");

    expect(await game.store.listItems(game.playerId)).toHaveLength(2);
    expect(await game.materialQty("forge_dust")).toBe(0);
  });
});
