import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type {
  AutoSellSettings,
  DungeonRun,
  FoundationPlayerState,
  Hero,
  InventoryItem,
  MaterialBalance,
  TavernOffer,
  Team,
} from "@idle/api-contract";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import {
  commandOutcomes,
  dungeonRuns,
  heroes,
  inventorySettings,
  playerItems,
  playerMaterials,
  players,
  sessions,
  tavernStates,
  teams,
} from "./schema.js";
import * as schema from "./schema.js";
import type { GameStore, StoredCommandOutcome, StoredTavernState } from "../store.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const COMMAND_OUTCOME_TTL_MS = 24 * 60 * 60 * 1_000;

export class PostgresGameStore implements GameStore {
  private readonly pool: Pool;
  private readonly db: NodePgDatabase<typeof schema>;
  private readonly transactionClient = new AsyncLocalStorage<PoolClient>();

  constructor(connectionString: string) {
    if (!connectionString.trim()) {
      throw new Error("PostgresGameStore requires a database connection string");
    }

    this.pool = new Pool({ connectionString });
    this.db = drizzle({ client: this.pool, schema });
  }

  private database(): NodePgDatabase<typeof schema> {
    const client = this.transactionClient.getStore();
    return client ? drizzle({ client, schema }) : this.db;
  }

  private async pruneExpiredCommandOutcomes(playerId: string): Promise<void> {
    const cutoff = new Date(Date.now() - COMMAND_OUTCOME_TTL_MS);
    await this.database()
      .delete(commandOutcomes)
      .where(and(eq(commandOutcomes.playerId, playerId), lt(commandOutcomes.createdAt, cutoff)));
  }

  async createGuest(sessionHash: string): Promise<FoundationPlayerState> {
    const player: FoundationPlayerState = {
      id: randomUUID(),
      version: 0,
      gold: 1_000,
      hallLevel: 1,
    };
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    await this.db.transaction(async (tx) => {
      await tx.insert(players).values({
        id: player.id,
        version: player.version,
        gold: player.gold,
        hallLevel: player.hallLevel,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(sessions).values({
        sessionHash,
        playerId: player.id,
        createdAt: now,
        expiresAt,
      });
    });

    return { ...player };
  }

  async findPlayerIdBySessionHash(sessionHash: string): Promise<string | undefined> {
    const [row] = await this.database()
      .select({ playerId: sessions.playerId })
      .from(sessions)
      .where(and(eq(sessions.sessionHash, sessionHash), gt(sessions.expiresAt, new Date())))
      .limit(1);

    return row?.playerId;
  }

  async getPlayer(playerId: string): Promise<FoundationPlayerState | undefined> {
    const [row] = await this.database()
      .select({
        id: players.id,
        version: players.version,
        gold: players.gold,
        hallLevel: players.hallLevel,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    return row ? { ...row } : undefined;
  }

  async setPlayer(player: FoundationPlayerState): Promise<void> {
    await this.database()
      .update(players)
      .set({
        version: player.version,
        gold: player.gold,
        hallLevel: player.hallLevel,
        updatedAt: new Date(),
      })
      .where(eq(players.id, player.id));
  }

  async getCommandOutcome(
    playerId: string,
    cmdId: string,
  ): Promise<StoredCommandOutcome | undefined> {
    await this.pruneExpiredCommandOutcomes(playerId);
    const cutoff = new Date(Date.now() - COMMAND_OUTCOME_TTL_MS);

    const [row] = await this.database()
      .select({
        statusCode: commandOutcomes.statusCode,
        body: commandOutcomes.body,
      })
      .from(commandOutcomes)
      .where(
        and(
          eq(commandOutcomes.playerId, playerId),
          eq(commandOutcomes.cmdId, cmdId),
          gt(commandOutcomes.createdAt, cutoff),
        ),
      )
      .limit(1);

    return row
      ? {
          statusCode: row.statusCode,
          body: row.body,
        }
      : undefined;
  }

  async setCommandOutcome(
    playerId: string,
    cmdId: string,
    outcome: StoredCommandOutcome,
  ): Promise<void> {
    await this.pruneExpiredCommandOutcomes(playerId);

    await this.database()
      .insert(commandOutcomes)
      .values({
        playerId,
        cmdId,
        statusCode: outcome.statusCode,
        body: outcome.body,
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [commandOutcomes.playerId, commandOutcomes.cmdId],
      });
  }

  async getTavernState(playerId: string): Promise<StoredTavernState | undefined> {
    const [row] = await this.database()
      .select({
        refreshesSinceRarePlus: tavernStates.refreshesSinceRarePlus,
        refreshesSinceLegendary: tavernStates.refreshesSinceLegendary,
        nextFreeRefreshAt: tavernStates.nextFreeRefreshAt,
        offers: tavernStates.offers,
      })
      .from(tavernStates)
      .where(eq(tavernStates.playerId, playerId))
      .limit(1);

    return row
      ? {
          refreshesSinceRarePlus: row.refreshesSinceRarePlus,
          refreshesSinceLegendary: row.refreshesSinceLegendary,
          nextFreeRefreshAt: row.nextFreeRefreshAt,
          offers: row.offers as TavernOffer[],
        }
      : undefined;
  }

  async setTavernState(playerId: string, state: StoredTavernState): Promise<void> {
    await this.database()
      .insert(tavernStates)
      .values({
        playerId,
        refreshesSinceRarePlus: state.refreshesSinceRarePlus,
        refreshesSinceLegendary: state.refreshesSinceLegendary,
        nextFreeRefreshAt: state.nextFreeRefreshAt,
        offers: state.offers,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tavernStates.playerId,
        set: {
          refreshesSinceRarePlus: state.refreshesSinceRarePlus,
          refreshesSinceLegendary: state.refreshesSinceLegendary,
          nextFreeRefreshAt: state.nextFreeRefreshAt,
          offers: state.offers,
          updatedAt: new Date(),
        },
      });
  }

  async listHeroes(playerId: string): Promise<Hero[]> {
    return this.database()
      .select({
        id: heroes.id,
        classId: heroes.classId,
        rarity: heroes.rarity,
        level: heroes.level,
        exp: heroes.exp,
        potential: heroes.potential,
      })
      .from(heroes)
      .where(eq(heroes.playerId, playerId))
      .orderBy(asc(heroes.createdAt), asc(heroes.id));
  }

  async createHero(playerId: string, input: Omit<Hero, "id">): Promise<Hero> {
    const hero: Hero = {
      id: randomUUID(),
      ...input,
    };

    await this.database()
      .insert(heroes)
      .values({
        id: hero.id,
        playerId,
        classId: hero.classId,
        rarity: hero.rarity,
        level: hero.level,
        exp: hero.exp,
        potential: hero.potential ?? { hp: 0, attack: 0, defense: 0, speed: 0 },
        createdAt: new Date(),
      });

    return {
      ...hero,
      potential: hero.potential ?? { hp: 0, attack: 0, defense: 0, speed: 0 },
    };
  }

  async setHeroProgress(
    playerId: string,
    updates: Array<Pick<Hero, "id" | "level" | "exp">>,
  ): Promise<Hero[]> {
    for (const update of updates) {
      await this.database()
        .update(heroes)
        .set({
          level: update.level,
          exp: update.exp,
        })
        .where(and(eq(heroes.playerId, playerId), eq(heroes.id, update.id)));
    }

    const updatedIds = new Set(updates.map((update) => update.id));
    return (await this.listHeroes(playerId)).filter((hero) => updatedIds.has(hero.id));
  }

  async setHero(playerId: string, hero: Hero): Promise<Hero> {
    const [row] = await this.database()
      .update(heroes)
      .set({
        classId: hero.classId,
        rarity: hero.rarity,
        level: hero.level,
        exp: hero.exp,
        potential: hero.potential ?? { hp: 0, attack: 0, defense: 0, speed: 0 },
      })
      .where(and(eq(heroes.playerId, playerId), eq(heroes.id, hero.id)))
      .returning({ id: heroes.id });

    if (!row) throw new Error(`Hero ${hero.id} was not found`);
    return {
      ...hero,
      potential: hero.potential ?? { hp: 0, attack: 0, defense: 0, speed: 0 },
    };
  }

  async listMaterials(playerId: string): Promise<MaterialBalance[]> {
    const rows = await this.database()
      .select({
        materialId: playerMaterials.materialId,
        qty: playerMaterials.qty,
      })
      .from(playerMaterials)
      .where(eq(playerMaterials.playerId, playerId));

    return rows.sort((left, right) => left.materialId.localeCompare(right.materialId));
  }

  async setMaterialQuantity(
    playerId: string,
    materialId: string,
    qty: number,
  ): Promise<MaterialBalance> {
    if (!Number.isInteger(qty) || qty < 0) {
      throw new Error("Material quantity must be a non-negative integer");
    }

    await this.database()
      .insert(playerMaterials)
      .values({
        playerId,
        materialId,
        qty,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [playerMaterials.playerId, playerMaterials.materialId],
        set: { qty, updatedAt: new Date() },
      });

    return { materialId, qty };
  }

  async listItems(playerId: string): Promise<InventoryItem[]> {
    return this.database()
      .select({
        id: playerItems.id,
        itemId: playerItems.itemId,
        slot: playerItems.slot,
        qualityBps: playerItems.qualityBps,
        enhanceLevel: playerItems.enhanceLevel,
        enhancePityFailures: playerItems.enhancePityFailures,
        locked: playerItems.locked,
        equippedHeroId: playerItems.equippedHeroId,
      })
      .from(playerItems)
      .where(eq(playerItems.playerId, playerId))
      .orderBy(asc(playerItems.createdAt), asc(playerItems.id));
  }

  async createItem(playerId: string, input: Omit<InventoryItem, "id">): Promise<InventoryItem> {
    const item: InventoryItem = { id: randomUUID(), ...input };
    await this.database().insert(playerItems).values({
      id: item.id,
      playerId,
      itemId: item.itemId,
      slot: item.slot,
      qualityBps: item.qualityBps,
      enhanceLevel: item.enhanceLevel,
      enhancePityFailures: item.enhancePityFailures,
      locked: item.locked,
      equippedHeroId: item.equippedHeroId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return item;
  }

  async setItem(playerId: string, item: InventoryItem): Promise<InventoryItem> {
    const [row] = await this.database()
      .update(playerItems)
      .set({
        itemId: item.itemId,
        slot: item.slot,
        qualityBps: item.qualityBps,
        enhanceLevel: item.enhanceLevel,
        enhancePityFailures: item.enhancePityFailures,
        locked: item.locked,
        equippedHeroId: item.equippedHeroId,
        updatedAt: new Date(),
      })
      .where(and(eq(playerItems.playerId, playerId), eq(playerItems.id, item.id)))
      .returning({ id: playerItems.id });

    if (!row) throw new Error(`Item ${item.id} was not found`);
    return item;
  }

  async deleteItem(playerId: string, itemId: string): Promise<boolean> {
    const rows = await this.database()
      .delete(playerItems)
      .where(and(eq(playerItems.playerId, playerId), eq(playerItems.id, itemId)))
      .returning({ id: playerItems.id });
    return rows.length > 0;
  }

  async getAutoSellSettings(playerId: string): Promise<AutoSellSettings> {
    const [row] = await this.database()
      .select({
        enabled: inventorySettings.autoSellEnabled,
        maxQualityBps: inventorySettings.maxQualityBps,
      })
      .from(inventorySettings)
      .where(eq(inventorySettings.playerId, playerId))
      .limit(1);

    return row ?? { enabled: false, maxQualityBps: 10_000 };
  }

  async setAutoSellSettings(
    playerId: string,
    settings: AutoSellSettings,
  ): Promise<AutoSellSettings> {
    await this.database()
      .insert(inventorySettings)
      .values({
        playerId,
        autoSellEnabled: settings.enabled,
        maxQualityBps: settings.maxQualityBps,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: inventorySettings.playerId,
        set: {
          autoSellEnabled: settings.enabled,
          maxQualityBps: settings.maxQualityBps,
          updatedAt: new Date(),
        },
      });

    return { ...settings };
  }

  async listTeams(playerId: string): Promise<Team[]> {
    const rows = await this.database()
      .select({
        slot: teams.slot,
        heroIds: teams.heroIds,
      })
      .from(teams)
      .where(eq(teams.playerId, playerId));

    return rows
      .map((row) => ({ slot: row.slot, heroIds: [...row.heroIds] }))
      .sort((left, right) => left.slot - right.slot);
  }

  async setTeam(playerId: string, team: Team): Promise<Team> {
    await this.database()
      .insert(teams)
      .values({
        playerId,
        slot: team.slot,
        heroIds: team.heroIds,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [teams.playerId, teams.slot],
        set: {
          heroIds: team.heroIds,
          updatedAt: new Date(),
        },
      });

    return { ...team, heroIds: [...team.heroIds] };
  }

  async listDungeonRuns(playerId: string): Promise<DungeonRun[]> {
    const rows = await this.database()
      .select({
        id: dungeonRuns.id,
        dungeonId: dungeonRuns.dungeonId,
        teamSlot: dungeonRuns.teamSlot,
        seed: dungeonRuns.seed,
        battleRules: dungeonRuns.battleRules,
        status: dungeonRuns.status,
        waves: dungeonRuns.waves,
        startedAt: dungeonRuns.startedAt,
        stoppedAt: dungeonRuns.stoppedAt,
        lastAccruedAt: dungeonRuns.lastAccruedAt,
        pendingCycles: dungeonRuns.pendingCycles,
        pendingGold: dungeonRuns.pendingGold,
        pendingExpPerHero: dungeonRuns.pendingExpPerHero,
        pendingMaterials: dungeonRuns.pendingMaterials,
        completedCycles: dungeonRuns.completedCycles,
      })
      .from(dungeonRuns)
      .where(eq(dungeonRuns.playerId, playerId))
      .orderBy(asc(dungeonRuns.startedAt), asc(dungeonRuns.id));

    return rows.map((row) => ({
      id: row.id,
      dungeonId: row.dungeonId,
      teamSlot: row.teamSlot,
      seed: row.seed,
      battleRules: row.battleRules,
      status: row.status,
      waves: row.waves,
      startedAt: row.startedAt.toISOString(),
      stoppedAt: row.stoppedAt?.toISOString() ?? null,
      lastAccruedAt: row.lastAccruedAt.toISOString(),
      pendingCycles: row.pendingCycles,
      pendingGold: row.pendingGold,
      pendingExpPerHero: row.pendingExpPerHero,
      pendingMaterials: row.pendingMaterials,
      completedCycles: row.completedCycles,
    }));
  }

  async createDungeonRun(playerId: string, input: Omit<DungeonRun, "id">): Promise<DungeonRun> {
    const run: DungeonRun = {
      id: randomUUID(),
      ...input,
    };

    await this.database()
      .insert(dungeonRuns)
      .values({
        id: run.id,
        playerId,
        dungeonId: run.dungeonId,
        teamSlot: run.teamSlot,
        seed: run.seed,
        battleRules: run.battleRules,
        status: run.status,
        waves: run.waves,
        startedAt: new Date(run.startedAt),
        stoppedAt: run.stoppedAt ? new Date(run.stoppedAt) : null,
        lastAccruedAt: new Date(run.lastAccruedAt),
        pendingCycles: run.pendingCycles,
        pendingGold: run.pendingGold,
        pendingExpPerHero: run.pendingExpPerHero,
        pendingMaterials: run.pendingMaterials,
        completedCycles: run.completedCycles,
      });

    return run;
  }

  async updateDungeonRun(playerId: string, run: DungeonRun): Promise<DungeonRun> {
    const [row] = await this.database()
      .update(dungeonRuns)
      .set({
        status: run.status,
        stoppedAt: run.stoppedAt ? new Date(run.stoppedAt) : null,
        lastAccruedAt: new Date(run.lastAccruedAt),
        pendingCycles: run.pendingCycles,
        pendingGold: run.pendingGold,
        pendingExpPerHero: run.pendingExpPerHero,
        pendingMaterials: run.pendingMaterials,
        completedCycles: run.completedCycles,
      })
      .where(and(eq(dungeonRuns.playerId, playerId), eq(dungeonRuns.id, run.id)))
      .returning({ id: dungeonRuns.id });

    if (!row) {
      throw new Error(`Dungeon run ${run.id} was not found`);
    }

    return run;
  }

  async stopDungeonRun(
    playerId: string,
    runId: string,
    stoppedAt: string,
  ): Promise<DungeonRun | undefined> {
    const [row] = await this.database()
      .update(dungeonRuns)
      .set({
        status: "stopped",
        stoppedAt: new Date(stoppedAt),
      })
      .where(
        and(
          eq(dungeonRuns.playerId, playerId),
          eq(dungeonRuns.id, runId),
          eq(dungeonRuns.status, "active"),
        ),
      )
      .returning({
        id: dungeonRuns.id,
        dungeonId: dungeonRuns.dungeonId,
        teamSlot: dungeonRuns.teamSlot,
        seed: dungeonRuns.seed,
        battleRules: dungeonRuns.battleRules,
        status: dungeonRuns.status,
        waves: dungeonRuns.waves,
        startedAt: dungeonRuns.startedAt,
        stoppedAt: dungeonRuns.stoppedAt,
        lastAccruedAt: dungeonRuns.lastAccruedAt,
        pendingCycles: dungeonRuns.pendingCycles,
        pendingGold: dungeonRuns.pendingGold,
        pendingExpPerHero: dungeonRuns.pendingExpPerHero,
        pendingMaterials: dungeonRuns.pendingMaterials,
        completedCycles: dungeonRuns.completedCycles,
      });

    return row
      ? {
          id: row.id,
          dungeonId: row.dungeonId,
          teamSlot: row.teamSlot,
          seed: row.seed,
          battleRules: row.battleRules,
          status: row.status,
          waves: row.waves,
          startedAt: row.startedAt.toISOString(),
          stoppedAt: row.stoppedAt?.toISOString() ?? null,
          lastAccruedAt: row.lastAccruedAt.toISOString(),
          pendingCycles: row.pendingCycles,
          pendingGold: row.pendingGold,
          pendingExpPerHero: row.pendingExpPerHero,
          pendingMaterials: row.pendingMaterials,
          completedCycles: row.completedCycles,
        }
      : undefined;
  }

  async withPlayerLock<T>(playerId: string, task: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let releaseError: Error | undefined;

    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM players WHERE id = $1 FOR UPDATE", [playerId]);

      const result = await this.transactionClient.run(client, task);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // Keep the original failure; a connection that cannot roll back must not be reused.
        releaseError =
          rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
      }
      throw error;
    } finally {
      client.release(releaseError);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
