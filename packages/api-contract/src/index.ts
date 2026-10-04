import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("server"),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const BuildingIdSchema = z.enum(["hall", "forge"]);
export type BuildingId = z.infer<typeof BuildingIdSchema>;

/** The one upgrade the builder is working on; the level applies once `completesAt` has passed. */
export const ConstructionSchema = z.object({
  building: BuildingIdSchema,
  targetLevel: z.number().int().min(2).max(10),
  startedAt: z.string().datetime(),
  completesAt: z.string().datetime(),
});
export type Construction = z.infer<typeof ConstructionSchema>;

export const FoundationPlayerStateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  hallLevel: z.number().int().min(1).max(10),
  forgeLevel: z.number().int().min(1).max(10).default(1),
  construction: ConstructionSchema.nullable().default(null),
  /** Dungeons whose boss this player has beaten; each one unlocks the next (GDD §5.4). */
  clearedDungeonIds: z.array(z.string().min(1)).default([]),
});

export type FoundationPlayerState = z.infer<typeof FoundationPlayerStateSchema>;

/** Building levels as of `serverTime`, with a finished construction already applied. */
export const BuildingsResponseSchema = z.object({
  ok: z.literal(true),
  serverTime: z.string().datetime(),
  hallLevel: z.number().int().min(1).max(10),
  forgeLevel: z.number().int().min(1).max(10),
  construction: ConstructionSchema.nullable(),
});
export type BuildingsResponse = z.infer<typeof BuildingsResponseSchema>;

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

export const EquipmentSlotSchema = z.enum(["weapon", "helmet", "armor", "accessory"]);
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>;

export const InventoryItemSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().min(1),
  slot: EquipmentSlotSchema,
  qualityBps: z.number().int().min(10_000).max(20_000),
  enhanceLevel: z.number().int().min(0).max(5),
  enhancePityFailures: z.number().int().nonnegative(),
  locked: z.boolean(),
  equippedHeroId: z.string().uuid().nullable(),
});

export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const InventoryResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(InventoryItemSchema),
});

export const AutoSellSettingsSchema = z.object({
  enabled: z.boolean(),
  maxQualityBps: z.number().int().min(10_000).max(20_000),
});
export type AutoSellSettings = z.infer<typeof AutoSellSettingsSchema>;

export const InventorySettingsResponseSchema = z.object({
  ok: z.literal(true),
  autoSell: AutoSellSettingsSchema,
});

export const CatalogEntrySchema = z.object({
  id: z.string().min(1),
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const RecipeIngredientViewSchema = z.object({
  materialId: z.string().min(1),
  qty: z.number().int().positive(),
});

export const ItemCatalogEntrySchema = CatalogEntrySchema.extend({
  slot: EquipmentSlotSchema,
  attack: z.number().int().nonnegative(),
  defense: z.number().int().nonnegative(),
  sellGold: z.number().int().nonnegative(),
  recipe: z.array(RecipeIngredientViewSchema).min(1),
});

export const CraftQualityTierSchema = z.object({
  id: z.string().min(1),
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  weightBps: z.number().int().min(0).max(10_000),
  multiplierBps: z.number().int().min(10_000).max(20_000),
  /** Forge Dust returned when an item of this quality is dismantled. */
  dismantleDust: z.number().int().positive(),
});

export const EquipmentRulesViewSchema = z.object({
  /** Base (Forge level 1) odds; `forge[].qualityWeightsBps` has the odds of every Forge level. */
  qualityTiers: z.array(CraftQualityTierSchema).min(1),
  enhanceBonusBps: z.array(z.number().int().nonnegative()).length(6),
  enhanceGoldCosts: z.array(z.number().int().nonnegative()).length(5),
  enhanceDustCosts: z.array(z.number().int().nonnegative()).length(5),
  forgeDustMaterialId: z.string().min(1),
  enhanceSuccessBps: z.array(z.number().int().min(0).max(10_000)).length(5),
  enhancePityStepBps: z.number().int().min(0).max(10_000),
});

export const DungeonCatalogEntrySchema = CatalogEntrySchema.extend({
  recommendedLevel: z.number().int().positive(),
  unlockAfterDungeonId: z.string().min(1).nullable(),
});

export const HallCatalogLevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  heroCapacity: z.number().int().positive(),
  teamLimit: z.number().int().min(1).max(4),
  /** Gold to upgrade from this level; null at the maximum level. */
  upgradeGoldCost: z.number().int().positive().nullable(),
  /** Seconds the upgrade from this level takes; null at the maximum level. */
  buildSeconds: z.number().int().positive().nullable(),
  upgradeMaterials: z.array(RecipeIngredientViewSchema),
});

export const ForgeCatalogLevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  /** Highest enhancement level this Forge level allows; 0 means enhancement is still locked. */
  maxEnhanceLevel: z.number().int().min(0).max(5),
  /** Craft quality odds at this level, in `equipment.qualityTiers` order. */
  qualityWeightsBps: z.array(z.number().int().min(0).max(10_000)).min(1),
  upgradeGoldCost: z.number().int().positive().nullable(),
  buildSeconds: z.number().int().positive().nullable(),
  upgradeMaterials: z.array(RecipeIngredientViewSchema),
});

export const BuildingRulesViewSchema = z.object({
  speedUpMaterialId: z.string().min(1),
  speedUpSecondsPerItem: z.number().int().positive(),
});

export const CatalogResponseSchema = z.object({
  ok: z.literal(true),
  classes: z.array(CatalogEntrySchema),
  dungeons: z.array(DungeonCatalogEntrySchema),
  hall: z.array(HallCatalogLevelSchema),
  forge: z.array(ForgeCatalogLevelSchema),
  buildings: BuildingRulesViewSchema,
  materials: z.array(CatalogEntrySchema),
  items: z.array(ItemCatalogEntrySchema),
  equipment: EquipmentRulesViewSchema,
});

export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

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
  /** Combat level (battle formula v2); absent on runs persisted with formula v1. */
  level: z.number().int().positive().optional(),
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
  /** Absent on runs persisted before battle formula v2. */
  formulaVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  maxTurns: z.number().int().positive(),
  defenseK: z.number().int().positive(),
  defenseKBase: z.number().int().positive().optional(),
  defenseKPerLevel: z.number().int().nonnegative().optional(),
  critCapBps: z.number().int().min(0).max(10_000).optional(),
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

/** One sampled idle cycle (docs/04 §6): rewards and kills up to the first lost wave. */
export const DungeonCycleSampleSchema = z.object({
  gold: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  kills: z.object({
    normal: z.number().int().nonnegative(),
    elite: z.number().int().nonnegative(),
    boss: z.number().int().nonnegative(),
  }),
});

export type DungeonCycleSample = z.infer<typeof DungeonCycleSampleSchema>;

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
  pendingMaterials: z.array(MaterialBalanceSchema).default([]),
  completedCycles: z.number().int().nonnegative(),
  waves: z.array(DungeonWaveReplaySchema).min(1).max(20),
  /** Idle cycle c pays cycleSamples[c % length]; null on runs started before sampling existed. */
  cycleSamples: z.array(DungeonCycleSampleSchema).min(1).max(100).nullable().default(null),
});

export type DungeonRun = z.infer<typeof DungeonRunSchema>;

export const DungeonRunsResponseSchema = z.object({
  ok: z.literal(true),
  runs: z.array(DungeonRunSchema),
});

/** Pays for the next level and starts the build timer; the level applies when it runs out. */
export const UpgradeBuildingCommandSchema = z.object({
  type: z.literal("upgrade_building"),
  building: BuildingIdSchema,
});

/** Spends up to `items` speed-up items; the server never uses more than the timer needs. */
export const SpeedUpConstructionCommandSchema = z.object({
  type: z.literal("speed_up_construction"),
  items: z.number().int().min(1).max(1_000),
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

export const EquipItemCommandSchema = z.object({
  type: z.literal("equip_item"),
  itemInstanceId: z.string().uuid(),
  heroId: z.string().uuid(),
});

export const UnequipItemCommandSchema = z.object({
  type: z.literal("unequip_item"),
  itemInstanceId: z.string().uuid(),
});

export const SetItemLockedCommandSchema = z.object({
  type: z.literal("set_item_locked"),
  itemInstanceId: z.string().uuid(),
  locked: z.boolean(),
});

export const SellItemCommandSchema = z.object({
  type: z.literal("sell_item"),
  itemInstanceId: z.string().uuid(),
});

export const DismantleItemCommandSchema = z.object({
  type: z.literal("dismantle_item"),
  itemInstanceId: z.string().uuid(),
});

export const CraftItemCommandSchema = z.object({
  type: z.literal("craft_item"),
  itemId: z.string().min(1),
});

export const EnhanceItemCommandSchema = z.object({
  type: z.literal("enhance_item"),
  itemInstanceId: z.string().uuid(),
});

export const SetAutoSellCommandSchema = z.object({
  type: z.literal("set_auto_sell"),
  enabled: z.boolean(),
  maxQualityBps: z.number().int().min(10_000).max(20_000),
});

export const CommandSchema = z.discriminatedUnion("type", [
  UpgradeBuildingCommandSchema,
  SpeedUpConstructionCommandSchema,
  DismantleItemCommandSchema,
  RefreshTavernCommandSchema,
  RecruitHeroCommandSchema,
  SetTeamCommandSchema,
  StartDungeonCommandSchema,
  StopDungeonCommandSchema,
  ClaimDungeonRewardsCommandSchema,
  PromoteHeroCommandSchema,
  EquipItemCommandSchema,
  UnequipItemCommandSchema,
  SetItemLockedCommandSchema,
  SellItemCommandSchema,
  CraftItemCommandSchema,
  EnhanceItemCommandSchema,
  SetAutoSellCommandSchema,
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
  forgeLevel: z.number().int().min(1).max(10).optional(),
  construction: ConstructionSchema.nullable().optional(),
  clearedDungeonIds: z.array(z.string().min(1)).optional(),
});

const BuildingUpgradeStartedEventSchema = z.object({
  type: z.literal("building_upgrade_started"),
  building: BuildingIdSchema,
  fromLevel: z.number().int().min(1).max(9),
  toLevel: z.number().int().min(2).max(10),
  goldCost: z.number().int().positive(),
  consumedMaterials: z.array(MaterialBalanceSchema),
  construction: ConstructionSchema,
});

const ConstructionSpedUpEventSchema = z.object({
  type: z.literal("construction_sped_up"),
  building: BuildingIdSchema,
  materialId: z.string().min(1),
  itemsUsed: z.number().int().positive(),
  /** True when the items finished the build; the patch then carries the new level. */
  completed: z.boolean(),
  construction: ConstructionSchema.nullable(),
});

const ItemDismantledEventSchema = z.object({
  type: z.literal("item_dismantled"),
  itemInstanceId: z.string().uuid(),
  materialId: z.string().min(1),
  dust: z.number().int().positive(),
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
  materials: z.array(MaterialBalanceSchema).default([]),
  /** Set when these cycles included the first boss kill in this dungeon (unlocks the next one). */
  clearedDungeonId: z.string().min(1).nullable().default(null),
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

const ItemEquippedEventSchema = z.object({
  type: z.literal("item_equipped"),
  item: InventoryItemSchema,
  replacedItemId: z.string().uuid().nullable(),
});

const ItemUnequippedEventSchema = z.object({
  type: z.literal("item_unequipped"),
  item: InventoryItemSchema,
});

const ItemLockChangedEventSchema = z.object({
  type: z.literal("item_lock_changed"),
  item: InventoryItemSchema,
});

const ItemSoldEventSchema = z.object({
  type: z.literal("item_sold"),
  itemInstanceId: z.string().uuid(),
  gold: z.number().int().nonnegative(),
});

const ItemCraftedEventSchema = z.object({
  type: z.literal("item_crafted"),
  item: InventoryItemSchema,
  consumedMaterials: z.array(MaterialBalanceSchema),
});

const ItemEnhancedEventSchema = z.object({
  type: z.literal("item_enhanced"),
  item: InventoryItemSchema,
  success: z.boolean(),
  beforeLevel: z.number().int().min(0).max(4),
  targetLevel: z.number().int().min(1).max(5),
  successBps: z.number().int().min(0).max(10_000),
  goldCost: z.number().int().nonnegative(),
  dustCost: z.number().int().nonnegative().default(0),
});

const AutoSellSettingsUpdatedEventSchema = z.object({
  type: z.literal("auto_sell_settings_updated"),
  autoSell: AutoSellSettingsSchema,
});

const ItemAutoSoldEventSchema = z.object({
  type: z.literal("item_auto_sold"),
  item: InventoryItemSchema,
  gold: z.number().int().nonnegative(),
});

export const CommandEventSchema = z.discriminatedUnion("type", [
  BuildingUpgradeStartedEventSchema,
  ConstructionSpedUpEventSchema,
  ItemDismantledEventSchema,
  TavernRefreshedEventSchema,
  HeroRecruitedEventSchema,
  TeamUpdatedEventSchema,
  DungeonStartedEventSchema,
  DungeonStoppedEventSchema,
  DungeonRewardsClaimedEventSchema,
  HeroPromotedEventSchema,
  ItemEquippedEventSchema,
  ItemUnequippedEventSchema,
  ItemLockChangedEventSchema,
  ItemSoldEventSchema,
  ItemCraftedEventSchema,
  ItemEnhancedEventSchema,
  AutoSellSettingsUpdatedEventSchema,
  ItemAutoSoldEventSchema,
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
  "ITEM_NOT_FOUND",
  "ITEM_LOCKED",
  "ITEM_EQUIPPED",
  "ITEM_SLOT_CONFLICT",
  "ITEM_DEFINITION_NOT_FOUND",
  "ITEM_MAX_ENHANCE",
  "INTERNAL_ERROR",
  "DUNGEON_LOCKED",
  "TEAM_LIMIT_REACHED",
  "BUILDER_BUSY",
  "NO_CONSTRUCTION",
  "FORGE_LEVEL_TOO_LOW",
]);

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  code: ApiErrorCodeSchema,
  message: z.string().min(1),
  currentVersion: z.number().int().nonnegative().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
