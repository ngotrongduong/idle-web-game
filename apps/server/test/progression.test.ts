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
  expect(guest.json().state.clearedDungeonIds).toEqual([]);
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

  async function hero(classId: string, level: number) {
    return store.createHero(playerId, { classId, rarity: "common", level, exp: 0 });
  }

  return { store, playerId, send, hero };
}

describe("dungeon unlocks (GDD §5.4)", () => {
  it("keeps Mistmoor locked until the Thornwood boss is beaten and claimed", async () => {
    const { store, playerId, send, hero } = await setup();
    const team = await Promise.all([hero("ward_squire", 10), hero("trail_archer", 10)]);
    await send({ type: "set_team", slot: 1, heroIds: team.map((entry) => entry.id) });

    const locked = await send({ type: "start_dungeon", dungeonId: "misty_riverbank", teamSlot: 1 });
    expect(locked.statusCode).toBe(409);
    expect(locked.json().code).toBe("DUNGEON_LOCKED");

    const start = await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 });
    const run = start.json().events[0].run;
    expect(
      run.cycleSamples.some((sample: { kills: { boss: number } }) => sample.kills.boss > 0),
    ).toBe(true);
    await store.updateDungeonRun(playerId, {
      ...run,
      lastAccruedAt: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
    });
    const claim = await send({ type: "claim_dungeon_rewards", runId: run.id });
    expect(claim.json().patch.clearedDungeonIds).toEqual(["bamboo_grove"]);
    expect(claim.json().events[0].clearedDungeonId).toBe("bamboo_grove");
    expect((await store.getPlayer(playerId))!.clearedDungeonIds).toEqual(["bamboo_grove"]);

    await send({ type: "stop_dungeon", runId: run.id });
    const unlocked = await send({
      type: "start_dungeon",
      dungeonId: "misty_riverbank",
      teamSlot: 1,
    });
    expect(unlocked.statusCode).toBe(200);
  });

  it("does not unlock anything when the claimed cycles never beat the boss", async () => {
    const { store, playerId, send, hero } = await setup();
    const recruit = await hero("spark_adept", 1);
    await send({ type: "set_team", slot: 1, heroIds: [recruit.id] });
    const start = await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 });
    const run = start.json().events[0].run;
    await store.updateDungeonRun(playerId, {
      ...run,
      cycleSamples: run.cycleSamples.map((sample: { kills: object }) => ({
        ...sample,
        kills: { ...sample.kills, boss: 0 },
      })),
      lastAccruedAt: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
    });
    const claim = await send({ type: "claim_dungeon_rewards", runId: run.id });

    expect(claim.statusCode).toBe(200);
    expect(claim.json().events[0].clearedDungeonId).toBeNull();
    expect((await store.getPlayer(playerId))!.clearedDungeonIds).toEqual([]);
  });
});

describe("parallel team limit by Hall level (GDD §5.1)", () => {
  it("allows one active team at Hall Lv1 and two at Lv3", async () => {
    const { store, playerId, send, hero } = await setup();
    const [first, second, third] = await Promise.all([
      hero("ward_squire", 5),
      hero("trail_archer", 5),
      hero("dawn_acolyte", 5),
    ]);
    await send({ type: "set_team", slot: 1, heroIds: [first!.id] });
    await send({ type: "set_team", slot: 2, heroIds: [second!.id] });
    await send({ type: "set_team", slot: 3, heroIds: [third!.id] });

    expect(
      (await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 1 })).statusCode,
    ).toBe(200);
    const blocked = await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 2 });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().code).toBe("TEAM_LIMIT_REACHED");

    await store.setPlayer({ ...(await store.getPlayer(playerId))!, hallLevel: 3 });
    const second2 = await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 2 });
    expect(second2.statusCode).toBe(200);
    const third2 = await send({ type: "start_dungeon", dungeonId: "bamboo_grove", teamSlot: 3 });
    expect(third2.json().code).toBe("TEAM_LIMIT_REACHED");
  });
});
