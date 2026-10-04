import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  AutoSellSettings,
  BattleRulesSnapshot,
  DungeonCycleSample,
  DungeonRun,
  DungeonWaveReplay,
  EquipmentSlot,
  HeroPotential,
  HeroRarity,
  InventoryItem,
  MaterialBalance,
  TavernOffer,
} from "@idle/api-contract";

export const players = pgTable("players", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull().default(0),
  gold: integer("gold").notNull().default(1_000),
  hallLevel: integer("hall_level").notNull().default(1),
  clearedDungeonIds: jsonb("cleared_dungeon_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    sessionHash: varchar("session_hash", { length: 64 }).primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_player_id_idx").on(table.playerId)],
);

export const commandOutcomes = pgTable(
  "command_outcomes",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    cmdId: text("cmd_id").notNull(),
    statusCode: integer("status_code").notNull(),
    body: jsonb("body").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.cmdId] }),
    index("command_outcomes_created_at_idx").on(table.createdAt),
  ],
);

export const tavernStates = pgTable("tavern_states", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  refreshesSinceRarePlus: integer("refreshes_since_rare_plus").notNull().default(0),
  refreshesSinceLegendary: integer("refreshes_since_legendary").notNull().default(0),
  nextFreeRefreshAt: timestamp("next_free_refresh_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  offers: jsonb("offers").$type<TavernOffer[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const heroes = pgTable(
  "heroes",
  {
    id: uuid("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    classId: text("class_id").notNull(),
    rarity: varchar("rarity", { length: 16 }).$type<HeroRarity>().notNull(),
    level: integer("level").notNull().default(1),
    exp: integer("exp").notNull().default(0),
    potential: jsonb("potential")
      .$type<HeroPotential>()
      .notNull()
      .default({ hp: 0, attack: 0, defense: 0, speed: 0 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("heroes_player_id_idx").on(table.playerId)],
);

export const playerMaterials = pgTable(
  "player_materials",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    materialId: text("material_id").notNull(),
    qty: integer("qty").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.materialId] }),
    index("player_materials_player_id_idx").on(table.playerId),
  ],
);

export const playerItems = pgTable(
  "player_items",
  {
    id: uuid("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    slot: varchar("slot", { length: 16 }).$type<EquipmentSlot>().notNull(),
    qualityBps: integer("quality_bps").notNull().default(10_000),
    enhanceLevel: integer("enhance_level").notNull().default(0),
    enhancePityFailures: integer("enhance_pity_failures").notNull().default(0),
    locked: boolean("locked").notNull().default(false),
    equippedHeroId: uuid("equipped_hero_id").references(() => heroes.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("player_items_player_id_idx").on(table.playerId),
    index("player_items_equipped_hero_id_idx").on(table.equippedHeroId),
  ],
);

export type PlayerItemRow = InventoryItem;

export const inventorySettings = pgTable("inventory_settings", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  autoSellEnabled: boolean("auto_sell_enabled").notNull().default(false),
  maxQualityBps: integer("max_quality_bps").notNull().default(10_000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InventorySettingsRow = AutoSellSettings;

export const teams = pgTable(
  "teams",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    heroIds: jsonb("hero_ids").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.slot] }),
    index("teams_player_id_idx").on(table.playerId),
  ],
);

export const dungeonRuns = pgTable(
  "dungeon_runs",
  {
    id: uuid("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    dungeonId: text("dungeon_id").notNull(),
    teamSlot: integer("team_slot").notNull(),
    seed: bigint("seed", { mode: "number" }).notNull(),
    battleRules: jsonb("battle_rules").$type<BattleRulesSnapshot>().notNull(),
    status: varchar("status", { length: 16 }).$type<DungeonRun["status"]>().notNull(),
    waves: jsonb("waves").$type<DungeonWaveReplay[]>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    lastAccruedAt: timestamp("last_accrued_at", { withTimezone: true }).notNull(),
    pendingCycles: integer("pending_cycles").notNull().default(0),
    pendingGold: integer("pending_gold").notNull().default(0),
    pendingExpPerHero: integer("pending_exp_per_hero").notNull().default(0),
    pendingMaterials: jsonb("pending_materials").$type<MaterialBalance[]>().notNull().default([]),
    cycleSamples: jsonb("cycle_samples").$type<DungeonCycleSample[]>(),
    completedCycles: integer("completed_cycles").notNull().default(0),
  },
  (table) => [index("dungeon_runs_player_id_idx").on(table.playerId)],
);
