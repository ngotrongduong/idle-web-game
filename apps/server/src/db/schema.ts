import {
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
import type { HeroRarity, TavernOffer } from "@idle/api-contract";

export const players = pgTable("players", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull().default(0),
  gold: integer("gold").notNull().default(1_000),
  hallLevel: integer("hall_level").notNull().default(1),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("heroes_player_id_idx").on(table.playerId)],
);

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
