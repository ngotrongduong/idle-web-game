import {
  ApiErrorSchema,
  CommandEnvelopeSchema,
  CommandSuccessSchema,
  DungeonRunsResponseSchema,
  FoundationPlayerStateSchema,
  GuestAuthResponseSchema,
  CatalogResponseSchema,
  HealthResponseSchema,
  HeroesResponseSchema,
  InventoryResponseSchema,
  MaterialsResponseSchema,
  PromotionStateResponseSchema,
  TavernResponseSchema,
  TeamsResponseSchema,
  type ApiError,
  type FoundationPlayerState,
} from "@idle/api-contract";
import {
  calculateHeroStats,
  resolveUpgradeAttempt,
  SeededRng,
  HALL_MAX_LEVEL,
  hallUpgradeGoldCost,
  heroCapacityForHall,
  levelCapForTier,
  retainHeroPotential,
} from "@idle/game-core";
import {
  enhancementGoldCost,
  equipmentConfig,
  foundationGameData,
  itemSellGold,
  promotionConfig,
  promotionRuleForTier,
} from "@idle/game-data";
import { randomBytes } from "node:crypto";
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
import { grantHeroExperience } from "./progression.js";
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

async function creditMaterials(
  store: GameStore,
  playerId: string,
  credits: readonly { materialId: string; qty: number }[],
) {
  if (credits.length === 0) return;
  const balances = new Map(
    (await store.listMaterials(playerId)).map((entry) => [entry.materialId, entry.qty]),
  );
  for (const credit of credits) {
    await store.setMaterialQuantity(
      playerId,
      credit.materialId,
      (balances.get(credit.materialId) ?? 0) + credit.qty,
    );
  }
}

async function accrueActiveDungeonRuns(store: GameStore, playerId: string, now = new Date()) {
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

function createEquipmentSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

function rollCraftQualityBps(seed = createEquipmentSeed()): number {
  const rng = new SeededRng(seed);
  const roll = rng.nextInt(10_000);
  let cursor = 0;
  for (const tier of equipmentConfig.qualityTiers) {
    cursor += tier.weightBps;
    if (roll < cursor) return tier.multiplierBps;
  }
  return equipmentConfig.baseQualityBps;
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

  const catalog = CatalogResponseSchema.parse({
    ok: true,
    classes: foundationGameData.classes.map(({ id, nameVi, nameEn }) => ({ id, nameVi, nameEn })),
    dungeons: foundationGameData.dungeons.map(({ id, nameVi, nameEn }) => ({ id, nameVi, nameEn })),
    materials: foundationGameData.materials.map(({ id, nameVi, nameEn }) => ({
      id,
      nameVi,
      nameEn,
    })),
    items: foundationGameData.items.map(({ id, nameVi, nameEn, slot, attack, defense }) => ({
      id,
      nameVi,
      nameEn,
      slot,
      attack,
      defense,
      sellGold: itemSellGold({ attack, defense }),
      recipe: foundationGameData.items.find((entry) => entry.id === id)!.recipe,
    })),
    equipment: {
      qualityTiers: equipmentConfig.qualityTiers,
      enhanceBonusBps: equipmentConfig.enhanceBonusBps,
      enhanceGoldCosts: equipmentConfig.enhanceGoldCosts,
      enhanceSuccessBps: equipmentConfig.enhanceSuccessBps,
    },
  });
  app.get("/api/v1/catalog", async () => catalog);

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

  app.get("/api/v1/materials", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    return MaterialsResponseSchema.parse({
      ok: true,
      materials: await store.listMaterials(playerId),
    });
  });

  app.get("/api/v1/inventory", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    return InventoryResponseSchema.parse({
      ok: true,
      items: await store.listItems(playerId),
    });
  });

  app.get("/api/v1/promotion", async (request, reply) => {
    const playerId = await authenticate(request, store);
    if (!playerId) {
      return reply.code(401).send(apiError("UNAUTHORIZED", "A valid session is required"));
    }

    const [heroes, runs, materials] = await Promise.all([
      store.listHeroes(playerId),
      store.listDungeonRuns(playerId),
      store.listMaterials(playerId),
    ]);
    const activeHeroIds = new Set(
      runs
        .filter((run) => run.status === "active")
        .flatMap((run) => run.waves[0]?.allies.map((ally) => ally.id) ?? []),
    );

    return PromotionStateResponseSchema.parse({
      ok: true,
      materials,
      heroes: heroes.map((hero) => {
        const heroClass = foundationGameData.classes.find((entry) => entry.id === hero.classId);
        if (!heroClass) throw new Error(`Unknown hero class: ${hero.classId}`);

        const rule = promotionRuleForTier(heroClass.tier);
        const targets = foundationGameData.classes
          .filter((entry) => entry.parentClassId === heroClass.id)
          .map((entry) => ({
            classId: entry.id,
            nameVi: entry.nameVi,
            nameEn: entry.nameEn,
            tier: entry.tier,
          }));

        return {
          heroId: hero.id,
          currentClassId: heroClass.id,
          currentClassNameVi: heroClass.nameVi,
          currentTier: heroClass.tier,
          levelCap: levelCapForTier(heroClass.tier),
          atLevelCap: hero.level === levelCapForTier(heroClass.tier),
          busy: activeHeroIds.has(hero.id),
          targets,
          rule: rule
            ? {
                goldCost: rule.goldCost,
                sealMaterialId: rule.sealMaterialId,
                sealQty: rule.sealQty,
              }
            : null,
        };
      }),
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
        const equipment = await store.listItems(playerId);
        const waves = simulateDungeonCycle({
          heroes: teamHeroes.filter((hero) => hero !== undefined),
          dungeonId,
          seed,
          equipment,
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
          pendingMaterials: [],
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
        const { runId } = envelope.command;
        const existing = (await store.listDungeonRuns(playerId)).find((run) => run.id === runId);

        if (!existing) {
          const missingRun: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("DUNGEON_RUN_NOT_FOUND", "Dungeon run was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingRun);
          return missingRun;
        }

        const accrued = accrueDungeonRunRewards(existing);
        const run =
          accrued === existing ? existing : await store.updateDungeonRun(playerId, accrued);

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
        const claimedMaterials = run.pendingMaterials;

        const ownedHeroIds = new Set((await store.listHeroes(playerId)).map((hero) => hero.id));
        const missingHeroId = heroIds.find((heroId) => !ownedHeroIds.has(heroId));
        if (missingHeroId) {
          const staleHero: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "TEAM_HERO_NOT_FOUND",
              `Dungeon reward hero ${missingHeroId} no longer exists`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, staleHero);
          return staleHero;
        }

        await grantHeroExperience(store, playerId, heroIds, claimedExpPerHero);
        await creditMaterials(store, playerId, claimedMaterials);
        await store.updateDungeonRun(playerId, {
          ...run,
          pendingCycles: 0,
          pendingGold: 0,
          pendingExpPerHero: 0,
          pendingMaterials: [],
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
              materials: claimedMaterials,
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

      if (envelope.command.type === "promote_hero") {
        const { heroId, targetClassId } = envelope.command;
        const hero = (await store.listHeroes(playerId)).find(
          (candidate) => candidate.id === heroId,
        );
        if (!hero) {
          const missing: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("HERO_NOT_FOUND", "Hero was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missing);
          return missing;
        }

        const currentClass = foundationGameData.classes.find((entry) => entry.id === hero.classId);
        if (!currentClass) throw new Error(`Unknown hero class: ${hero.classId}`);

        if (currentClass.tier >= 3) {
          const maxTier: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("HERO_MAX_TIER", "Hero is already at maximum tier", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, maxTier);
          return maxTier;
        }

        const requiredLevel = levelCapForTier(currentClass.tier);
        if (hero.level !== requiredLevel) {
          const notCapped: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "HERO_NOT_AT_LEVEL_CAP",
              `Hero must reach level ${requiredLevel} before promotion`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, notCapped);
          return notCapped;
        }

        const targetClass = foundationGameData.classes.find((entry) => entry.id === targetClassId);
        if (
          !targetClass ||
          targetClass.parentClassId !== currentClass.id ||
          targetClass.tier !== currentClass.tier + 1
        ) {
          const invalidBranch: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "HERO_PROMOTION_INVALID_BRANCH",
              "Target class is not a direct promotion branch for this hero",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, invalidBranch);
          return invalidBranch;
        }

        const isBusy = (await store.listDungeonRuns(playerId)).some(
          (run) =>
            run.status === "active" &&
            (run.waves[0]?.allies.some((ally) => ally.id === hero.id) ?? false),
        );
        if (isBusy) {
          const busy: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "HERO_BUSY",
              "Hero cannot be promoted while an active dungeon run uses its snapshot",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, busy);
          return busy;
        }

        const rule = promotionRuleForTier(currentClass.tier);
        if (!rule) throw new Error(`Missing promotion rule for tier ${currentClass.tier}`);

        if (state.gold < rule.goldCost) {
          const insufficientGold: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("INSUFFICIENT_GOLD", "Not enough gold for promotion", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, insufficientGold);
          return insufficientGold;
        }

        const sealBalance =
          (await store.listMaterials(playerId)).find(
            (entry) => entry.materialId === rule.sealMaterialId,
          )?.qty ?? 0;
        if (sealBalance < rule.sealQty) {
          const insufficientSeal: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "INSUFFICIENT_MATERIAL",
              `Promotion requires ${rule.sealQty} ${rule.sealMaterialId}`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, insufficientSeal);
          return insufficientSeal;
        }

        const currentStats = calculateHeroStats({
          baseHp: currentClass.baseHp,
          baseAttack: currentClass.baseAttack,
          baseDefense: currentClass.baseDefense,
          baseSpeed: currentClass.baseSpeed,
          level: hero.level,
          rarity: hero.rarity,
          ...(hero.potential ? { potential: hero.potential } : {}),
        });
        const potential = retainHeroPotential(currentStats, promotionConfig.retainedPotentialBps);
        const promotedHero = {
          ...hero,
          classId: targetClass.id,
          level: 1,
          exp: 0,
          potential,
        };

        await store.setHero(playerId, promotedHero);
        await store.setMaterialQuantity(playerId, rule.sealMaterialId, sealBalance - rule.sealQty);

        const nextState: FoundationPlayerState = {
          ...state,
          version: state.version + 1,
          gold: state.gold - rule.goldCost,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: { gold: nextState.gold },
          events: [
            {
              type: "hero_promoted",
              hero: promotedHero,
              fromClassId: currentClass.id,
              toClassId: targetClass.id,
              goldCost: rule.goldCost,
              sealMaterialId: rule.sealMaterialId,
              sealQty: rule.sealQty,
              retainedPotentialBps: promotionConfig.retainedPotentialBps,
            },
          ],
        });
        const stored: StoredCommandOutcome = { statusCode: 200, body: success };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "craft_item") {
        const spec = foundationGameData.items.find(
          (entry) => entry.id === envelope.command.itemId,
        );
        if (!spec) {
          const missing: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "ITEM_DEFINITION_NOT_FOUND",
              "Crafting item definition was not found",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missing);
          return missing;
        }

        const balances = new Map(
          (await store.listMaterials(playerId)).map((entry) => [entry.materialId, entry.qty]),
        );
        const insufficientIngredient = spec.recipe.find(
          (ingredient) => (balances.get(ingredient.materialId) ?? 0) < ingredient.qty,
        );
        if (insufficientIngredient) {
          const insufficient: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "INSUFFICIENT_MATERIAL",
              `Not enough ${insufficientIngredient.materialId} to craft ${spec.id}`,
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, insufficient);
          return insufficient;
        }
        if (state.gold < equipmentConfig.craftGoldCost) {
          const insufficientGold: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("INSUFFICIENT_GOLD", "Not enough gold to craft item", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, insufficientGold);
          return insufficientGold;
        }

        for (const ingredient of spec.recipe) {
          await store.setMaterialQuantity(
            playerId,
            ingredient.materialId,
            (balances.get(ingredient.materialId) ?? 0) - ingredient.qty,
          );
        }

        const item = await store.createItem(playerId, {
          itemId: spec.id,
          slot: spec.slot,
          qualityBps: rollCraftQualityBps(),
          enhanceLevel: 0,
          enhancePityFailures: 0,
          locked: false,
          equippedHeroId: null,
        });
        const nextState = {
          ...state,
          version: state.version + 1,
          gold: state.gold - equipmentConfig.craftGoldCost,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: equipmentConfig.craftGoldCost > 0 ? { gold: nextState.gold } : {},
          events: [
            {
              type: "item_crafted",
              item,
              consumedMaterials: spec.recipe.map((ingredient) => ({
                materialId: ingredient.materialId,
                qty: ingredient.qty,
              })),
            },
          ],
        });
        const stored: StoredCommandOutcome = { statusCode: 200, body: success };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "enhance_item") {
        const { itemInstanceId } = envelope.command;
        const item = (await store.listItems(playerId)).find(
          (candidate) => candidate.id === itemInstanceId,
        );
        if (!item) {
          const missing: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_NOT_FOUND", "Item was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missing);
          return missing;
        }
        if (item.enhanceLevel >= equipmentConfig.maxEnhanceLevel) {
          const maxed: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_MAX_ENHANCE", "Item is already at maximum enhancement", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, maxed);
          return maxed;
        }

        const goldCost = enhancementGoldCost(item.enhanceLevel);
        if (state.gold < goldCost) {
          const insufficient: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("INSUFFICIENT_GOLD", "Not enough gold to enhance item", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, insufficient);
          return insufficient;
        }

        const result = resolveUpgradeAttempt(
          { level: item.enhanceLevel, pityFailures: item.enhancePityFailures },
          new SeededRng(createEquipmentSeed()),
        );
        const enhancedItem = await store.setItem(playerId, {
          ...item,
          enhanceLevel: Math.min(result.afterLevel, equipmentConfig.maxEnhanceLevel),
          enhancePityFailures: result.pityFailures,
        });
        const nextState = {
          ...state,
          version: state.version + 1,
          gold: state.gold - goldCost,
        };
        await store.setPlayer(nextState);

        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: { gold: nextState.gold },
          events: [
            {
              type: "item_enhanced",
              item: enhancedItem,
              success: result.success,
              beforeLevel: result.beforeLevel,
              targetLevel: result.targetLevel,
              successBps: result.successBps,
              goldCost,
            },
          ],
        });
        const stored: StoredCommandOutcome = { statusCode: 200, body: success };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "equip_item") {
        const { itemInstanceId, heroId } = envelope.command;
        const [items, heroes] = await Promise.all([
          store.listItems(playerId),
          store.listHeroes(playerId),
        ]);
        const item = items.find((candidate) => candidate.id === itemInstanceId);
        if (!item) {
          const missing: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_NOT_FOUND", "Item was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missing);
          return missing;
        }
        if (!heroes.some((hero) => hero.id === heroId)) {
          const missingHero: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("HERO_NOT_FOUND", "Hero was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missingHero);
          return missingHero;
        }
        if (item.equippedHeroId && item.equippedHeroId !== heroId) {
          const equipped: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError(
              "ITEM_EQUIPPED",
              "Item is equipped by another hero; unequip it first",
              state.version,
            ),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, equipped);
          return equipped;
        }

        const replaced = items.find(
          (candidate) =>
            candidate.id !== item.id &&
            candidate.equippedHeroId === heroId &&
            candidate.slot === item.slot,
        );
        if (replaced) {
          await store.setItem(playerId, { ...replaced, equippedHeroId: null });
        }
        const equippedItem = await store.setItem(playerId, {
          ...item,
          equippedHeroId: heroId,
        });

        const nextState = { ...state, version: state.version + 1 };
        await store.setPlayer(nextState);
        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [
            {
              type: "item_equipped",
              item: equippedItem,
              replacedItemId: replaced?.id ?? null,
            },
          ],
        });
        const stored = { statusCode: 200, body: success };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "unequip_item") {
        const { itemInstanceId } = envelope.command;
        const item = (await store.listItems(playerId)).find(
          (candidate) => candidate.id === itemInstanceId,
        );
        if (!item) {
          const missing: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_NOT_FOUND", "Item was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missing);
          return missing;
        }

        const unequipped = await store.setItem(playerId, {
          ...item,
          equippedHeroId: null,
        });
        const nextState = { ...state, version: state.version + 1 };
        await store.setPlayer(nextState);
        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [{ type: "item_unequipped", item: unequipped }],
        });
        const stored = { statusCode: 200, body: success };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "set_item_locked") {
        const { itemInstanceId, locked: shouldLock } = envelope.command;
        const item = (await store.listItems(playerId)).find(
          (candidate) => candidate.id === itemInstanceId,
        );
        if (!item) {
          const missing: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_NOT_FOUND", "Item was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missing);
          return missing;
        }

        const lockedItem = await store.setItem(playerId, {
          ...item,
          locked: shouldLock,
        });
        const nextState = { ...state, version: state.version + 1 };
        await store.setPlayer(nextState);
        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: {},
          events: [{ type: "item_lock_changed", item: lockedItem }],
        });
        const stored = { statusCode: 200, body: success };
        await store.setCommandOutcome(playerId, envelope.cmdId, stored);
        return stored;
      }

      if (envelope.command.type === "sell_item") {
        const { itemInstanceId } = envelope.command;
        const item = (await store.listItems(playerId)).find(
          (candidate) => candidate.id === itemInstanceId,
        );
        if (!item) {
          const missing: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_NOT_FOUND", "Item was not found", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, missing);
          return missing;
        }
        if (item.locked) {
          const locked: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_LOCKED", "Locked items cannot be sold", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, locked);
          return locked;
        }
        if (item.equippedHeroId) {
          const equipped: StoredCommandOutcome = {
            statusCode: 409,
            body: apiError("ITEM_EQUIPPED", "Equipped items cannot be sold", state.version),
          };
          await store.setCommandOutcome(playerId, envelope.cmdId, equipped);
          return equipped;
        }

        const spec = foundationGameData.items.find((entry) => entry.id === item.itemId);
        if (!spec) throw new Error(`Unknown item definition: ${item.itemId}`);
        const baseSellGold = itemSellGold(spec);
        const sellGold = Math.floor(
          (baseSellGold * item.qualityBps) / equipmentConfig.baseQualityBps,
        );

        await store.deleteItem(playerId, item.id);
        const nextState = {
          ...state,
          version: state.version + 1,
          gold: state.gold + sellGold,
        };
        await store.setPlayer(nextState);
        const success = CommandSuccessSchema.parse({
          ok: true,
          version: nextState.version,
          patch: { gold: nextState.gold },
          events: [
            {
              type: "item_sold",
              itemInstanceId: item.id,
              gold: sellGold,
            },
          ],
        });
        const stored = { statusCode: 200, body: success };
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
