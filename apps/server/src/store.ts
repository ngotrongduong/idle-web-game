import { randomUUID } from "node:crypto";
import type { FoundationPlayerState, Hero, TavernOffer } from "@idle/api-contract";

export type StoredCommandOutcome = {
  statusCode: number;
  body: unknown;
};

export type StoredTavernState = {
  refreshesSinceRarePlus: number;
  refreshesSinceLegendary: number;
  nextFreeRefreshAt: Date;
  offers: TavernOffer[];
};

export interface GameStore {
  createGuest(sessionHash: string): Promise<FoundationPlayerState>;
  findPlayerIdBySessionHash(sessionHash: string): Promise<string | undefined>;
  getPlayer(playerId: string): Promise<FoundationPlayerState | undefined>;
  setPlayer(player: FoundationPlayerState): Promise<void>;
  getCommandOutcome(playerId: string, cmdId: string): Promise<StoredCommandOutcome | undefined>;
  setCommandOutcome(playerId: string, cmdId: string, outcome: StoredCommandOutcome): Promise<void>;
  getTavernState(playerId: string): Promise<StoredTavernState | undefined>;
  setTavernState(playerId: string, state: StoredTavernState): Promise<void>;
  listHeroes(playerId: string): Promise<Hero[]>;
  createHero(playerId: string, input: Omit<Hero, "id">): Promise<Hero>;
  withPlayerLock<T>(playerId: string, task: () => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}

function copyTavernState(state: StoredTavernState): StoredTavernState {
  return {
    ...state,
    nextFreeRefreshAt: new Date(state.nextFreeRefreshAt),
    offers: state.offers.map((offer) => ({ ...offer })),
  };
}

export class InMemoryGameStore implements GameStore {
  private readonly players = new Map<string, FoundationPlayerState>();
  private readonly sessions = new Map<string, string>();
  private readonly commandOutcomes = new Map<string, Map<string, StoredCommandOutcome>>();
  private readonly taverns = new Map<string, StoredTavernState>();
  private readonly heroes = new Map<string, Hero[]>();
  private readonly lockTails = new Map<string, Promise<void>>();

  async createGuest(sessionHash: string): Promise<FoundationPlayerState> {
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

  async findPlayerIdBySessionHash(sessionHash: string): Promise<string | undefined> {
    return this.sessions.get(sessionHash);
  }

  async getPlayer(playerId: string): Promise<FoundationPlayerState | undefined> {
    const player = this.players.get(playerId);
    return player ? { ...player } : undefined;
  }

  async setPlayer(player: FoundationPlayerState): Promise<void> {
    this.players.set(player.id, { ...player });
  }

  async getCommandOutcome(
    playerId: string,
    cmdId: string,
  ): Promise<StoredCommandOutcome | undefined> {
    return this.commandOutcomes.get(playerId)?.get(cmdId);
  }

  async setCommandOutcome(
    playerId: string,
    cmdId: string,
    outcome: StoredCommandOutcome,
  ): Promise<void> {
    let outcomes = this.commandOutcomes.get(playerId);
    if (!outcomes) {
      outcomes = new Map();
      this.commandOutcomes.set(playerId, outcomes);
    }
    outcomes.set(cmdId, outcome);
  }

  async getTavernState(playerId: string): Promise<StoredTavernState | undefined> {
    const state = this.taverns.get(playerId);
    return state ? copyTavernState(state) : undefined;
  }

  async setTavernState(playerId: string, state: StoredTavernState): Promise<void> {
    this.taverns.set(playerId, copyTavernState(state));
  }

  async listHeroes(playerId: string): Promise<Hero[]> {
    return (this.heroes.get(playerId) ?? []).map((hero) => ({ ...hero }));
  }

  async createHero(playerId: string, input: Omit<Hero, "id">): Promise<Hero> {
    const hero: Hero = {
      id: randomUUID(),
      ...input,
    };
    const heroes = this.heroes.get(playerId) ?? [];
    heroes.push(hero);
    this.heroes.set(playerId, heroes);
    return { ...hero };
  }

  async withPlayerLock<T>(playerId: string, task: () => Promise<T>): Promise<T> {
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
