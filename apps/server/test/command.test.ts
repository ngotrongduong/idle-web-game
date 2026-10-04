import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";

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
});
