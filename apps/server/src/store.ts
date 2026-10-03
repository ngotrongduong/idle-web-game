import { randomUUID } from "node:crypto";
import type { FoundationPlayerState } from "@idle/api-contract";

export type StoredCommandOutcome = {
  statusCode: number;
  body: unknown;
};

export class InMemoryGameStore {
  private readonly players = new Map<string, FoundationPlayerState>();
  private readonly sessions = new Map<string, string>();
  private readonly commandOutcomes = new Map<
    string,
    Map<string, StoredCommandOutcome>
  >();
  private readonly lockTails = new Map<string, Promise<void>>();

  createGuest(sessionHash: string): FoundationPlayerState {
    const player: FoundationPlayerState = {
      id: randomUUID(),
      version: 0,
      gold: 1_000,
      hallLevel: 1,
    };

    this.players.set(player.id, player);
    this.sessions.set(sessionHash, player.id);
    return { ...player };
  }

  findPlayerIdBySessionHash(sessionHash: string): string | undefined {
    return this.sessions.get(sessionHash);
  }

  getPlayer(playerId: string): FoundationPlayerState | undefined {
    const player = this.players.get(playerId);
    return player ? { ...player } : undefined;
  }

  setPlayer(player: FoundationPlayerState): void {
    this.players.set(player.id, { ...player });
  }

  getCommandOutcome(
    playerId: string,
    cmdId: string,
  ): StoredCommandOutcome | undefined {
    return this.commandOutcomes.get(playerId)?.get(cmdId);
  }

  setCommandOutcome(
    playerId: string,
    cmdId: string,
    outcome: StoredCommandOutcome,
  ): void {
    let outcomes = this.commandOutcomes.get(playerId);
    if (!outcomes) {
      outcomes = new Map();
      this.commandOutcomes.set(playerId, outcomes);
    }
    outcomes.set(cmdId, outcome);
  }

  async withPlayerLock<T>(
    playerId: string,
    task: () => Promise<T> | T,
  ): Promise<T> {
    const previous = this.lockTails.get(playerId) ?? Promise.resolve();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.lockTails.set(playerId, tail);

    await previous;

    try {
      return await task();
    } finally {
      release();
      if (this.lockTails.get(playerId) === tail) {
        this.lockTails.delete(playerId);
      }
    }
  }
}
