import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { FoundationPlayerState } from "@idle/api-contract";
import { and, eq, gt, lt } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { commandOutcomes, players, sessions } from "./schema.js";
import * as schema from "./schema.js";
import type { GameStore, StoredCommandOutcome } from "../store.js";

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

  async withPlayerLock<T>(playerId: string, task: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM players WHERE id = $1 FOR UPDATE", [playerId]);

      const result = await this.transactionClient.run(client, task);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
