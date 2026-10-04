import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("server"),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const FoundationPlayerStateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  hallLevel: z.number().int().min(1).max(10),
});

export type FoundationPlayerState = z.infer<typeof FoundationPlayerStateSchema>;

export const GuestAuthResponseSchema = z.object({
  ok: z.literal(true),
  state: FoundationPlayerStateSchema,
});

export const HeroRaritySchema = z.enum(["common", "elite", "rare", "legendary"]);

export type HeroRarity = z.infer<typeof HeroRaritySchema>;

export const HeroPotentialSchema = z.object({
  hp: z.number().int().nonnegative(),
  attack: z.number().int().nonnegative(),
  defense: z.number().int().nonnegative(),
  speed: z.number().int().nonnegative(),
});

export type HeroPotential = z.infer<typeof HeroPotentialSchema>;

export const HeroSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().min(1),
  rarity: HeroRaritySchema,
  level: z.number().int().positive(),
  exp: z.number().int().nonnegative(),
  potential: HeroPotentialSchema.optional(),
});

export type Hero = z.infer<typeof HeroSchema>;

export const TavernOfferSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().min(1),
  rarity: HeroRaritySchema,
});

export type TavernOffer = z.infer<typeof TavernOfferSchema>;

export const TavernStateSchema = z.object({
  refreshesSinceRarePlus: z.number().int().nonnegative(),
  refreshesSinceLegendary: z.number().int().nonnegative(),
  nextFreeRefreshAt: z.string().datetime(),
  offers: z.array(TavernOfferSchema).max(3),
});

export type TavernState = z.infer<typeof TavernStateSchema>;

export const TavernResponseSchema = z.object({
  ok: z.literal(true),
  tavern: TavernStateSchema,
});

export const HeroesResponseSchema = z.object({
  ok: z.literal(true),
  heroes: z.array(HeroSchema),
});

export const MaterialBalanceSchema = z.object({
  materialId: z.string().min(1),
  qty: z.number().int().nonnegative(),
});

export type MaterialBalance = z.infer<typeof MaterialBalanceSchema>;

export const MaterialsResponseSchema = z.object({
  ok: z.literal(true),
  materials: z.array(MaterialBalanceSchema),
});

export const PromotionTargetSchema = z.object({
  classId: z.string().min(1),
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  tier: z.number().int().min(2).max(3),
});

export const PromotionRuleViewSchema = z.object({
  goldCost: z.number().int().nonnegative(),
  sealMaterialId: z.string().min(1),
  sealQty: z.number().int().positive(),
});

export const HeroPromotionStateSchema = z.object({
  heroId: z.string().uuid(),
  currentClassId: z.string().min(1),
  currentClassNameVi: z.string().min(1),
  currentTier: z.number().int().min(1).max(3),
  levelCap: z.number().int().positive(),
  atLevelCap: z.boolean(),
  busy: z.boolean(),
  targets: z.array(PromotionTargetSchema),
  rule: PromotionRuleViewSchema.nullable(),
});

export type HeroPromotionState = z.infer<typeof HeroPromotionStateSchema>;

export const PromotionStateResponseSchema = z.object({
  ok: z.literal(true),
  materials: z.array(MaterialBalanceSchema),
  heroes: z.array(HeroPromotionStateSchema),
});

export type PromotionStateResponse = z.infer<typeof PromotionStateResponseSchema>;

export const TeamSchema = z.object({
  slot: z.number().int().min(1).max(4),
  heroIds: z.array(z.string().uuid()).max(4),
});

export type Team = z.infer<typeof TeamSchema>;

export const TeamsResponseSchema = z.object({
  ok: z.literal(true),
  teams: z.array(TeamSchema).max(4),
});

export const BattleUnitSnapshotSchema = z.object({
  id: z.string().min(1),
  hp: z.number().int().positive(),
  attack: z.number().int().positive(),
  defense: z.number().int().nonnegative(),
  speed: z.number().int().nonnegative(),
  critBps: z.number().int().min(0).max(10_000).optional(),
  familyId: z.string().min(1).optional(),
  targeting: z.enum(["random", "lowest_hp", "highest_attack"]).optional(),
  ultimatePowerBps: z.number().int().positive().optional(),
  ultimateKind: z.enum(["damage", "heal"]).optional(),
  ultimateTargeting: z.enum(["random", "lowest_hp", "highest_attack"]).optional(),
  startingMp: z.number().int().nonnegative().optional(),
});

export type BattleUnitSnapshot = z.infer<typeof BattleUnitSnapshotSchema>;

export const DungeonWaveReplaySchema = z.object({
  wave: z.number().int().min(1).max(20),
  seed: z.number().int().min(0).max(4_294_967_295),
  result: z.enum(["win", "lose", "draw"]),
  turns: z.number().int().nonnegative(),
  hash: z.string().regex(/^[0-9a-f]{8}$/),
  allies: z.array(BattleUnitSnapshotSchema).min(1).max(4),
  enemies: z.array(BattleUnitSnapshotSchema).min(1),
  rewardGold: z.number().int().nonnegative(),
  rewardExp: z.number().int().nonnegative(),
});

export type DungeonWaveReplay = z.infer<typeof DungeonWaveReplaySchema>;

export const BattleRulesSnapshotSchema = z.object({
  maxTurns: z.number().int().positive(),
  defenseK: z.number().int().positive(),
  varianceMinBps: z.number().int().positive(),
  varianceMaxBps: z.number().int().positive(),
  defaultCritBps: z.number().int().min(0).max(10_000),
  critMultiplierBps: z.number().int().positive(),
  mpMax: z.number().int().positive(),
  mpPerAction: z.number().int().nonnegative(),
  mpOnHit: z.number().int().nonnegative(),
  familyAdvantage: z.record(z.string(), z.string()),
  advantageMultiplierBps: z.number().int().positive(),
  disadvantageMultiplierBps: z.number().int().positive(),
});

export type BattleRulesSnapshot = z.infer<typeof BattleRulesSnapshotSchema>;

export const DungeonRunSchema = z.object({
  id: z.string().uuid(),
  dungeonId: z.string().min(1),
  teamSlot: z.number().int().min(1).max(4),
  seed: z.number().int().min(0).max(4_294_967_295),
  battleRules: BattleRulesSnapshotSchema,
  status: z.enum(["active", "stopped"]),
  startedAt: z.string().datetime(),
  stoppedAt: z.string().datetime().nullable(),
  lastAccruedAt: z.string().datetime(),
  pendingCycles: z.number().int().nonnegative(),
  pendingGold: z.number().int().nonnegative(),
  pendingExpPerHero: z.number().int().nonnegative(),
  completedCycles: z.number().int().nonnegative(),
  waves: z.array(DungeonWaveReplaySchema).min(1).max(20),
});

export type DungeonRun = z.infer<typeof DungeonRunSchema>;

export const DungeonRunsResponseSchema = z.object({
  ok: z.literal(true),
  runs: z.array(DungeonRunSchema),
});

export const UpgradeHallCommandSchema = z.object({
  type: z.literal("upgrade_hall"),
});

export const RefreshTavernCommandSchema = z.object({
  type: z.literal("refresh_tavern"),
});

export const RecruitHeroCommandSchema = z.object({
  type: z.literal("recruit_hero"),
  offerId: z.string().uuid(),
});

export const SetTeamCommandSchema = z.object({
  type: z.literal("set_team"),
  slot: z.number().int().min(1).max(4),
  heroIds: z.array(z.string().uuid()).max(4),
});

export const StartDungeonCommandSchema = z.object({
  type: z.literal("start_dungeon"),
  dungeonId: z.string().min(1),
  teamSlot: z.number().int().min(1).max(4),
});

export const StopDungeonCommandSchema = z.object({
  type: z.literal("stop_dungeon"),
  runId: z.string().uuid(),
});

export const ClaimDungeonRewardsCommandSchema = z.object({
  type: z.literal("claim_dungeon_rewards"),
  runId: z.string().uuid(),
});

export const PromoteHeroCommandSchema = z.object({
  type: z.literal("promote_hero"),
  heroId: z.string().uuid(),
  targetClassId: z.string().min(1),
});

export const CommandSchema = z.discriminatedUnion("type", [
  UpgradeHallCommandSchema,
  RefreshTavernCommandSchema,
  RecruitHeroCommandSchema,
  SetTeamCommandSchema,
  StartDungeonCommandSchema,
  StopDungeonCommandSchema,
  ClaimDungeonRewardsCommandSchema,
  PromoteHeroCommandSchema,
]);

export type GameCommand = z.infer<typeof CommandSchema>;

export const CommandEnvelopeSchema = z.object({
  cmdId: z.string().uuid(),
  expectVersion: z.number().int().nonnegative(),
  command: CommandSchema,
});

export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;

export const CommandPatchSchema = z.object({
  gold: z.number().int().nonnegative().optional(),
  hallLevel: z.number().int().min(1).max(10).optional(),
});

const HallUpgradedEventSchema = z.object({
  type: z.literal("hall_upgraded"),
  fromLevel: z.number().int().min(1).max(9),
  toLevel: z.number().int().min(2).max(10),
  goldCost: z.number().int().positive(),
});

const TavernRefreshedEventSchema = z.object({
  type: z.literal("tavern_refreshed"),
  tavern: TavernStateSchema,
});

const HeroRecruitedEventSchema = z.object({
  type: z.literal("hero_recruited"),
  hero: HeroSchema,
  remainingOffers: z.array(TavernOfferSchema).max(2),
});

const TeamUpdatedEventSchema = z.object({
  type: z.literal("team_updated"),
  team: TeamSchema,
});

const DungeonStartedEventSchema = z.object({
  type: z.literal("dungeon_started"),
  run: DungeonRunSchema,
});

const DungeonStoppedEventSchema = z.object({
  type: z.literal("dungeon_stopped"),
  run: DungeonRunSchema,
});

const DungeonRewardsClaimedEventSchema = z.object({
  type: z.literal("dungeon_rewards_claimed"),
  runId: z.string().uuid(),
  cycles: z.number().int().positive(),
  gold: z.number().int().nonnegative(),
  expPerHero: z.number().int().nonnegative(),
  heroIds: z.array(z.string().uuid()).min(1).max(4),
});

const HeroPromotedEventSchema = z.object({
  type: z.literal("hero_promoted"),
  hero: HeroSchema,
  fromClassId: z.string().min(1),
  toClassId: z.string().min(1),
  goldCost: z.number().int().nonnegative(),
  sealMaterialId: z.string().min(1),
  sealQty: z.number().int().positive(),
  retainedPotentialBps: z.number().int().min(0).max(10_000),
});

export const CommandEventSchema = z.discriminatedUnion("type", [
  HallUpgradedEventSchema,
  TavernRefreshedEventSchema,
  HeroRecruitedEventSchema,
  TeamUpdatedEventSchema,
  DungeonStartedEventSchema,
  DungeonStoppedEventSchema,
  DungeonRewardsClaimedEventSchema,
  HeroPromotedEventSchema,
]);

export const CommandSuccessSchema = z.object({
  ok: z.literal(true),
  version: z.number().int().positive(),
  patch: CommandPatchSchema,
  events: z.array(CommandEventSchema),
});

export type CommandSuccess = z.infer<typeof CommandSuccessSchema>;

export const ApiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "INVALID_COMMAND",
  "VERSION_CONFLICT",
  "INSUFFICIENT_GOLD",
  "MAX_LEVEL",
  "NOT_FOUND",
  "TAVERN_COOLDOWN",
  "HERO_CAPACITY_FULL",
  "OFFER_NOT_FOUND",
  "TEAM_DUPLICATE_HERO",
  "TEAM_HERO_NOT_FOUND",
  "TEAM_HERO_ALREADY_ASSIGNED",
  "TEAM_NOT_FOUND",
  "TEAM_EMPTY",
  "DUNGEON_NOT_FOUND",
  "DUNGEON_RUN_ALREADY_ACTIVE",
  "DUNGEON_RUN_NOT_FOUND",
  "DUNGEON_REWARDS_EMPTY",
  "HERO_NOT_FOUND",
  "HERO_NOT_AT_LEVEL_CAP",
  "HERO_PROMOTION_INVALID_BRANCH",
  "HERO_MAX_TIER",
  "HERO_BUSY",
  "INSUFFICIENT_MATERIAL",
]);

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  code: ApiErrorCodeSchema,
  message: z.string().min(1),
  currentVersion: z.number().int().nonnegative().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
