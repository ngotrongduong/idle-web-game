import {
  ApiErrorSchema,
  CommandEnvelopeSchema,
  CommandSuccessSchema,
  FoundationPlayerStateSchema,
  GuestAuthResponseSchema,
  HealthResponseSchema,
  HeroesResponseSchema,
  TavernResponseSchema,
  type ApiError,
  type FoundationPlayerState,
} from "@idle/api-contract";
import { HALL_MAX_LEVEL, hallUpgradeGoldCost, heroCapacityForHall } from "@idle/game-core";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import {
  createSessionToken,
  hashSessionToken,
  readCookie,
  SESSION_COOKIE,
  sessionCookieHeader,
} from "./session.js";
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
      version: "m1.1",
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
        const tavern = (await store.getTavernState(playerId)) ?? emptyTavernState();
        const offer = tavern.offers.find((candidate) => candidate.id === envelope.command.offerId);

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
