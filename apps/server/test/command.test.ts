import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { foundationGameData } from "@idle/game-data";
import { applyHeroExperience } from "@idle/game-core";
import { buildServer } from "../src/app.js";
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
});
