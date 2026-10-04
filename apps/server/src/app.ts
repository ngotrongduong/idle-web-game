import {
  ApiErrorSchema,
  CommandEnvelopeSchema,
  CommandSuccessSchema,
  DungeonRunsResponseSchema,
  FoundationPlayerStateSchema,
  GuestAuthResponseSchema,
  HealthResponseSchema,
  HeroesResponseSchema,
  TavernResponseSchema,
  TeamsResponseSchema,
  type ApiError,
  type FoundationPlayerState,
} from "@idle/api-contract";
import { HALL_MAX_LEVEL, hallUpgradeGoldCost, heroCapacityForHall } from "@idle/game-core";
import { foundationGameData } from "@idle/game-data";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import {
  createSessionToken,
  hashSessionToken,
  readCookie,
  SESSION_COOKIE,
  sessionCookieHeader,
} from "./session.js";
import {
  CURRENT_DUNGEON_BATTLE_RULES,
  createDungeonSeed,
  simulateDungeonCycle,
} from "./dungeon.js";
import { accrueDungeonRunRewards } from "./idle.js";
import { createConfiguredGameStore } from "./store-factory.js";
import { type GameStore, type StoredCommandOutcome } from "./store.js";
import { emptyTavernState, refreshTavernOffers, serializeTavernState } from "./tavern.js";

function apiError(code: ApiError["code"], message: string, currentVersion?: number): ApiError {
  return ApiErrorSchema.parse({
    ok: false,
    code,
    message,
    ...(currentVersion === undefined ? {} : { currentVersion }),
  });
}

async function authenticate(
  request: FastifyRequest,
  store: GameStore,
): Promise<string | undefined> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return undefined;
  return store.findPlayerIdBySessionHash(hashSessionToken(token));
}

function sendStored(reply: FastifyReply, outcome: StoredCommandOutcome) {
  return reply.code(outcome.statusCode).send(outcome.body);
}

async function accrueActiveDungeonRuns(
  store: GameStore,
  playerId: string,
  now = new Date(),
) {
  const runs = await store.listDungeonRuns(playerId);
  const accruedRuns = [];

  for (const run of runs) {
    const accrued = accrueDungeonRunRewards(run, now);
    accruedRuns.push(accrued);
    if (accrued !== run) {
      await store.updateDungeonRun(playerId, accrued);
    }
  }

  return accruedRuns;
}

export function buildServer(options?: { store?: GameStore }) {
  const app = Fastify({ logger: false });
  const store = options?.store ?? createConfiguredGameStore();

  app.addHook("onClose", async () => {
    await store.close?.();
  });

  app.get("/health", async () =>
    HealthResponseSchema.parse({
      ok: true,
      service: "server",
      version: "m1.2",
    }),
  );

  app.post("/api/v1/auth/guest", async (_request, reply) => {
    const token = createSessionToken();
    const state = await store.createGuest(hashSessionToken(token));

    reply.header("set-cookie", sessionCookieHeader(token));
    return GuestAuthResponseSchema.parse({
      ok: true,
      state,
    });
  });

  app.get("/api/v1/state", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    const state = await store.getPlayer(playerId);
    if (!state) {
      return reply.code(404).send(apiError("NOT_FOUND", "Player state was not found"));
    }

    return FoundationPlayerStateSchema.parse(state);
  });

  app.get("/api/v1/tavern", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    const tavern = (await store.getTavernState(playerId)) ?? emptyTavernState();

    return TavernResponseSchema.parse({
      ok: true,
      tavern: serializeTavernState(tavern),
    });
  });

  app.get("/api/v1/teams", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    return TeamsResponseSchema.parse({
      ok: true,
      teams: await store.listTeams(playerId),
    });
  });

  app.get("/api/v1/dungeon-runs", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    const runs = await store.withPlayerLock(playerId, () =>
      accrueActiveDungeonRuns(store, playerId),
    );

    return DungeonRunsResponseSchema.parse({
      ok: true,
      runs,
    });
  });

  app.get("/api/v1/heroes", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    return HeroesResponseSchema.parse({
      ok: true,
      heroes: await store.listHeroes(playerId),
    });
  });

  app.post("/api/v1/cmd", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    const parsed = CommandEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(apiError("INVALID_COMMAND", "Command payload is invalid"));
    }

    const envelope = parsed.data;
    const outcome = await store.withPlayerLock(playerId, async () => {
      const cached = await store.getCommandOutcome(playerId, envelope.cmdId);
      if (cached) return cached;

      const state = await store.getPlayer(playerId);
      if (!state) {
        const missing: StoredCommandOutcome = {
          statusCode: 404,
          body: apiError("NOT_FOUND", "Player state was not found"),
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, missing);
        return missing;
      }

      if (state.version !== envelope.expectVersion) {
        const conflict: StoredCommandOutcome = {
          statusCode: 409,
          body: apiError("VERSION_CONFLICT", "Player state version does not match", state.version),
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, conflict);
        return conflict;
      }

      if (envelope.command.type === "upgrade_hall") {
        if (state.hallLevel >= HALL_MAX_LEVEL) {
          const maxed: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("MAX_LEVEL", "Hall is already at maximum level"),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, maxed);
          return maxed;
        }

        const goldCost = hallUpgradeGoldCost(state.hallLevel);
        if (state.gold < goldCost) {
          const insufficient: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("INSUFFICIENT_GOLD", "Not enough gold to upgrade the hall"),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, insufficient);
          return insufficient;
        }

        const fromLevel = state.hallLevel;
        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
          gold: state.gold - goldCost,
          hallLevel: state.hallLevel + 1,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {
            gold: nextState.gold,
            hallLevel: nextState.hallLevel,
          },
          events: [
            {
              type: "hall_upgraded",
              fromLevel,
              toLevel: nextState.hallLevel,
              goldCost,
            },
          ],
        });

        const stored: StoredCommandOutcome = {
          statusCode: 200,
          body: success,
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "refresh_tavern") {
        const currentTavern = (await store.getTavernState(playerId)) ?? emptyTavernState();
        const now = new Date();

        if (currentTavern.nextFreeRefreshAt.getTime() > now.getTime()) {
          const cooldown: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TAVERN_COOLDOWN",
              `Next free tavern refresh is available at ${currentTavern.nextFreeRefreshAt.toISOString()}`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, cooldown);
          return cooldown;
        }

        const tavern = refreshTavernOffers(currentTavern, now);
        await store.setTavernState(playerId, tavern);

        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [
            {
              type: "tavern_refreshed",
              tavern: serializeTavernState(tavern),
            },
          ],
        });
        const stored: StoredCommandOutcome = {
          statusCode: 200,
          body: success,
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "recruit_hero") {
        const offerId = envelope.command.offerId;
        const tavern = (await store.getTavernState(playerId)) ?? emptyTavernState();
        const offer = tavern.offers.find((candidate) => candidate.id === offerId);

        if (!offer) {
          const missingOffer: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "OFFER_NOT_FOUND",
              "Tavern offer was not found or was already recruited",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingOffer);
          return missingOffer;
        }

        const heroes = await store.listHeroes(playerId);
        const capacity = heroCapacityForHall(state.hallLevel);
        if (heroes.length >= capacity) {
          const full: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "HERO_CAPACITY_FULL",
              `Hero capacity is full (${heroes.length}/${capacity})`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, full);
          return full;
        }

        const hero = await store.createHero(playerId, {
          classId: offer.classId,
          rarity: offer.rarity,
          level: 1,
          exp: 0,
        });

        const nextTavern = {
          ...tavern,
          offers: tavern.offers.filter((candidate) => candidate.id !== offer.id),
        };
        await store.setTavernState(playerId, nextTavern);

        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [
            {
              type: "hero_recruited",
              hero,
              remainingOffers: nextTavern.offers,
            },
          ],
        });
        const stored: StoredCommandOutcome = {
          statusCode: 200,
          body: success,
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "set_team") {
        const { slot, heroIds } = envelope.command;
        const uniqueHeroIds = new Set(heroIds);
        if (uniqueHeroIds.size !== heroIds.length) {
          const duplicate: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TEAM_DUPLICATE_HERO",
              "A hero can only appear once in the same team",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, duplicate);
          return duplicate;
        }

        const heroes = await store.listHeroes(playerId);
        const ownedHeroIds = new Set(heroes.map((hero) => hero.id));
        const missingHeroId = heroIds.find((heroId) => !ownedHeroIds.has(heroId));
        if (missingHeroId) {
          const missingHero: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TEAM_HERO_NOT_FOUND",
              `Hero ${missingHeroId} does not belong to this player`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingHero);
          return missingHero;
        }

        const teams = await store.listTeams(playerId);
        const assignedElsewhere = teams
          .filter((team) => team.slot !== slot)
          .flatMap((team) => team.heroIds)
          .find((heroId) => uniqueHeroIds.has(heroId));

        if (assignedElsewhere) {
          const alreadyAssigned: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TEAM_HERO_ALREADY_ASSIGNED",
              `Hero ${assignedElsewhere} is already assigned to another team`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, alreadyAssigned);
          return alreadyAssigned;
        }

        const team = await store.setTeam(playerId, {
          slot,
          heroIds: [...heroIds],
        });

        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [{ type: "team_updated", team }],
        });
        const stored: StoredCommandOutcome = {
          statusCode: 200,
          body: success,
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "start_dungeon") {
        const { dungeonId, teamSlot } = envelope.command;
        const dungeon = foundationGameData.dungeons.find((entry) => entry.id === dungeonId);
        if (!dungeon) {
          const missingDungeon: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "DUNGEON_NOT_FOUND",
              `Dungeon ${dungeonId} does not exist`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingDungeon);
          return missingDungeon;
        }

        const teams = await store.listTeams(playerId);
        const team = teams.find((entry) => entry.slot === teamSlot);
        if (!team) {
          const missingTeam: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TEAM_NOT_FOUND",
              `Team slot ${teamSlot} has not been configured`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingTeam);
          return missingTeam;
        }
        if (team.heroIds.length === 0) {
          const emptyTeam: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("TEAM_EMPTY", `Team slot ${teamSlot} has no heroes`, state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, emptyTeam);
          return emptyTeam;
        }

        const activeRun = (await store.listDungeonRuns(playerId)).find(
          (run) => run.teamSlot === teamSlot && run.status === "active",
        );
        if (activeRun) {
          const alreadyActive: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "DUNGEON_RUN_ALREADY_ACTIVE",
              `Team slot ${teamSlot} already has an active dungeon run`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, alreadyActive);
          return alreadyActive;
        }

        const heroesById = new Map(
          (await store.listHeroes(playerId)).map((hero) => [hero.id, hero]),
        );
        const teamHeroes = team.heroIds.map((heroId) => heroesById.get(heroId));
        if (teamHeroes.some((hero) => hero === undefined)) {
          const staleTeam: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TEAM_HERO_NOT_FOUND",
              "Team contains a hero that no longer exists",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, staleTeam);
          return staleTeam;
        }

        const seed = createDungeonSeed();
        const startedAt = new Date().toISOString();
        const waves = simulateDungeonCycle({
          heroes: teamHeroes.filter((hero) => hero !== undefined),
          dungeonId,
          seed,
        });
        const run = await store.createDungeonRun(playerId, {
          dungeonId,
          teamSlot,
          seed,
          battleRules: CURRENT_DUNGEON_BATTLE_RULES,
          status: "active",
          startedAt,
          stoppedAt: null,
          lastAccruedAt: startedAt,
          pendingCycles: 0,
          pendingGold: 0,
          pendingExpPerHero: 0,
          completedCycles: 0,
          waves,
        });

        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [{ type: "dungeon_started", run }],
        });
        const stored: StoredCommandOutcome = {
          statusCode: 200,
          body: success,
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "stop_dungeon") {
        await accrueActiveDungeonRuns(store, playerId);
        const run = await store.stopDungeonRun(
          playerId,
          envelope.command.runId,
          new Date().toISOString(),
        );
        if (!run) {
          const missingRun: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "DUNGEON_RUN_NOT_FOUND",
              "Active dungeon run was not found",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingRun);
          return missingRun;
        }

        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [{ type: "dungeon_stopped", run }],
        });
        const stored: StoredCommandOutcome = {
          statusCode: 200,
          body: success,
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "claim_dungeon_rewards") {
        const existing = (await store.listDungeonRuns(playerId)).find(
          (run) => run.id === envelope.command.runId,
        );

        if (!existing) {
          const missingRun: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "DUNGEON_RUN_NOT_FOUND",
              "Dungeon run was not found",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingRun);
          return missingRun;
        }

        const accrued = accrueDungeonRunRewards(existing);
        const run = accrued === existing ? existing : await store.updateDungeonRun(playerId, accrued);

        if (run.pendingCycles <= 0) {
          const empty: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "DUNGEON_REWARDS_EMPTY",
              "No completed idle dungeon cycles are ready to claim",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, empty);
          return empty;
        }

        const heroIds = [...new Set(run.waves[0]?.allies.map((hero) => hero.id) ?? [])];
        if (heroIds.length === 0) {
          const staleTeam: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TEAM_HERO_NOT_FOUND",
              "Dungeon run does not contain a valid hero snapshot",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, staleTeam);
          return staleTeam;
        }

        const claimedCycles = run.pendingCycles;
        const claimedGold = run.pendingGold;
        const claimedExpPerHero = run.pendingExpPerHero;

        await store.addHeroExp(playerId, heroIds, claimedExpPerHero);
        await store.updateDungeonRun(playerId, {
          ...run,
          pendingCycles: 0,
          pendingGold: 0,
          pendingExpPerHero: 0,
        });

        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
          gold: state.gold + claimedGold,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: { gold: nextState.gold },
          events: [
            {
              type: "dungeon_rewards_claimed",
              runId: run.id,
              cycles: claimedCycles,
              gold: claimedGold,
              expPerHero: claimedExpPerHero,
              heroIds,
            },
          ],
        });
        const stored: StoredCommandOutcome = {
          statusCode: 200,
          body: success,
        };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      const unreachable: StoredCommandOutcome = {
        statusCode: 400,
        body: apiError("INVALID_COMMAND", "Unsupported command"),
      };
      await store.setCommandOutcome(playerId, envelope.cmdId, unreachable);
      return unreachable;
    });

    return sendStored(reply, outcome);
  });

  return app;
}
