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
  setHeroProgress(
    playerId: string,
    updates: Array<Pick<Hero, "id" | "level" | "exp">>,
  ): Promise<Hero[]>;
  setHero(playerId: string, hero: Hero): Promise<Hero>;
  listMaterials(playerId: string): Promise<MaterialBalance[]>;
  setMaterialQuantity(playerId: string, materialId: string, qty: number): Promise<MaterialBalance>;
  listItems(playerId: string): Promise<InventoryItem[]>;
  createItem(playerId: string, input: Omit<InventoryItem, "id">): Promise<InventoryItem>;
  setItem(playerId: string, item: InventoryItem): Promise<InventoryItem>;
  deleteItem(playerId: string, itemId: string): Promise<boolean>;
  getAutoSellSettings(playerId: string): Promise<AutoSellSettings>;
  setAutoSellSettings(playerId: string, settings: AutoSellSettings): Promise<AutoSellSettings>;
  listTeams(playerId: string): Promise<Team[]>;
  setTeam(playerId: string, team: Team): Promise<Team>;
  listDungeonRuns(playerId: string): Promise<DungeonRun[]>;
  createDungeonRun(playerId: string, input: Omit<DungeonRun, "id">): Promise<DungeonRun>;
  updateDungeonRun(playerId: string, run: DungeonRun): Promise<DungeonRun>;
  stopDungeonRun(
    playerId: string,
    runId: string,
    stoppedAt: string,
  ): Promise<DungeonRun | undefined>;
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

function copyDungeonRun(run: DungeonRun): DungeonRun {
  return {
    ...run,
    pendingMaterials: run.pendingMaterials.map((entry) => ({ ...entry })),
    cycleSamples: run.cycleSamples
      ? run.cycleSamples.map((sample) => ({ ...sample, kills: { ...sample.kills } }))
      : null,
    waves: run.waves.map((wave) => ({
      ...wave,
      allies: wave.allies.map((unit) => ({ ...unit })),
      enemies: wave.enemies.map((unit) => ({ ...unit })),
    })),
  };
}

export class InMemoryGameStore implements GameStore {
  private readonly players = new Map<string, FoundationPlayerState>();
  private readonly sessions = new Map<string, string>();
  private readonly commandOutcomes = new Map<string, Map<string, StoredCommandOutcome>>();
  private readonly taverns = new Map<string, StoredTavernState>();
  private readonly heroes = new Map<string, Hero[]>();
  private readonly materials = new Map<string, Map<string, number>>();
  private readonly items = new Map<string, InventoryItem[]>();
  private readonly autoSellSettings = new Map<string, AutoSellSettings>();
  private readonly teams = new Map<string, Map<number, Team>>();
  private readonly dungeonRuns = new Map<string, DungeonRun[]>();
  private readonly lockTails = new Map<string, Promise<void>>();

  async createGuest(sessionHash: string): Promise<FoundationPlayerState> {
    const player: FoundationPlayerState = {
      id: randomUUID(),
      version: 0,
      gold: 1_000,
      hallLevel: 1,
      clearedDungeonIds: [],
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
    return player ? { ...player, clearedDungeonIds: [...player.clearedDungeonIds] } : undefined;
  }

  async setPlayer(player: FoundationPlayerState): Promise<void> {
    this.players.set(player.id, { ...player, clearedDungeonIds: [...player.clearedDungeonIds] });
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
    return (this.heroes.get(playerId) ?? []).map((hero) => ({
      ...hero,
      ...(hero.potential ? { potential: { ...hero.potential } } : {}),
    }));
  }

  async createHero(playerId: string, input: Omit<Hero, "id">): Promise<Hero> {
    const hero: Hero = {
      id: randomUUID(),
      ...input,
      potential: input.potential ?? { hp: 0, attack: 0, defense: 0, speed: 0 },
    };
    const heroes = this.heroes.get(playerId) ?? [];
    heroes.push(hero);
    this.heroes.set(playerId, heroes);
    return { ...hero };
  }

  async setHeroProgress(
    playerId: string,
    updates: Array<Pick<Hero, "id" | "level" | "exp">>,
  ): Promise<Hero[]> {
    const progressById = new Map(updates.map((update) => [update.id, update]));
    const heroes = this.heroes.get(playerId) ?? [];
    const updatedHeroes = heroes.map((hero) => {
      const progress = progressById.get(hero.id);
      return progress ? { ...hero, level: progress.level, exp: progress.exp } : hero;
    });
    this.heroes.set(playerId, updatedHeroes);
    return updatedHeroes.filter((hero) => progressById.has(hero.id)).map((hero) => ({ ...hero }));
  }

  async setHero(playerId: string, hero: Hero): Promise<Hero> {
    const heroes = this.heroes.get(playerId) ?? [];
    const index = heroes.findIndex((candidate) => candidate.id === hero.id);
    if (index < 0) throw new Error(`Hero ${hero.id} was not found`);
    const stored = {
      ...hero,
      ...(hero.potential ? { potential: { ...hero.potential } } : {}),
    };
    heroes[index] = stored;
    this.heroes.set(playerId, heroes);
    return { ...stored, ...(stored.potential ? { potential: { ...stored.potential } } : {}) };
  }

  async listMaterials(playerId: string): Promise<MaterialBalance[]> {
    return [...(this.materials.get(playerId)?.entries() ?? [])]
      .map(([materialId, qty]) => ({ materialId, qty }))
      .sort((left, right) => left.materialId.localeCompare(right.materialId));
  }

  async setMaterialQuantity(
    playerId: string,
    materialId: string,
    qty: number,
  ): Promise<MaterialBalance> {
    if (!Number.isInteger(qty) || qty < 0) {
      throw new Error("Material quantity must be a non-negative integer");
    }
    let inventory = this.materials.get(playerId);
    if (!inventory) {
      inventory = new Map();
      this.materials.set(playerId, inventory);
    }
    inventory.set(materialId, qty);
    return { materialId, qty };
  }

  async listItems(playerId: string): Promise<InventoryItem[]> {
    return (this.items.get(playerId) ?? []).map((item) => ({ ...item }));
  }

  async createItem(playerId: string, input: Omit<InventoryItem, "id">): Promise<InventoryItem> {
    const item: InventoryItem = { id: randomUUID(), ...input };
    const items = this.items.get(playerId) ?? [];
    items.push({ ...item });
    this.items.set(playerId, items);
    return { ...item };
  }

  async setItem(playerId: string, item: InventoryItem): Promise<InventoryItem> {
    const items = this.items.get(playerId) ?? [];
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) throw new Error(`Item ${item.id} was not found`);
    items[index] = { ...item };
    this.items.set(playerId, items);
    return { ...item };
  }

  async deleteItem(playerId: string, itemId: string): Promise<boolean> {
    const items = this.items.get(playerId) ?? [];
    const next = items.filter((item) => item.id !== itemId);
    if (next.length === items.length) return false;
    this.items.set(playerId, next);
    return true;
  }

  async getAutoSellSettings(playerId: string): Promise<AutoSellSettings> {
    return {
      ...(this.autoSellSettings.get(playerId) ?? { enabled: false, maxQualityBps: 10_000 }),
    };
  }

  async setAutoSellSettings(
    playerId: string,
    settings: AutoSellSettings,
  ): Promise<AutoSellSettings> {
    const stored = { ...settings };
    this.autoSellSettings.set(playerId, stored);
    return { ...stored };
  }

  async listTeams(playerId: string): Promise<Team[]> {
    return [...(this.teams.get(playerId)?.values() ?? [])]
      .sort((left, right) => left.slot - right.slot)
      .map((team) => ({ ...team, heroIds: [...team.heroIds] }));
  }

  async setTeam(playerId: string, team: Team): Promise<Team> {
    let playerTeams = this.teams.get(playerId);
    if (!playerTeams) {
      playerTeams = new Map();
      this.teams.set(playerId, playerTeams);
    }
    const stored = { ...team, heroIds: [...team.heroIds] };
    playerTeams.set(team.slot, stored);
    return { ...stored, heroIds: [...stored.heroIds] };
  }

  async listDungeonRuns(playerId: string): Promise<DungeonRun[]> {
    return (this.dungeonRuns.get(playerId) ?? []).map(copyDungeonRun);
  }

  async createDungeonRun(playerId: string, input: Omit<DungeonRun, "id">): Promise<DungeonRun> {
    const run: DungeonRun = {
      id: randomUUID(),
      ...input,
    };
    const runs = this.dungeonRuns.get(playerId) ?? [];
    runs.push(copyDungeonRun(run));
    this.dungeonRuns.set(playerId, runs);
    return copyDungeonRun(run);
  }

  async updateDungeonRun(playerId: string, run: DungeonRun): Promise<DungeonRun> {
    const runs = this.dungeonRuns.get(playerId) ?? [];
    const index = runs.findIndex((candidate) => candidate.id === run.id);
    if (index < 0) {
      throw new Error(`Dungeon run ${run.id} was not found`);
    }

    runs[index] = copyDungeonRun(run);
    this.dungeonRuns.set(playerId, runs);
    return copyDungeonRun(run);
  }

  async stopDungeonRun(
    playerId: string,
    runId: string,
    stoppedAt: string,
  ): Promise<DungeonRun | undefined> {
    const runs = this.dungeonRuns.get(playerId) ?? [];
    const index = runs.findIndex((run) => run.id === runId && run.status === "active");
    if (index < 0) return undefined;

    const stopped: DungeonRun = {
      ...runs[index]!,
      status: "stopped",
      stoppedAt,
    };
    runs[index] = copyDungeonRun(stopped);
    return copyDungeonRun(stopped);
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
