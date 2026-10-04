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

export const HeroRaritySchema = z.enum([
  "common",
  "elite",
  "rare",
  "legendary",
]);

export const HeroSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().min(1),
  rarity: HeroRaritySchema,
  level: z.number().int().positive(),
  exp: z.number().int().nonnegative(),
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

export const CommandSchema = z.discriminatedUnion("type", [
  UpgradeHallCommandSchema,
  RefreshTavernCommandSchema,
  RecruitHeroCommandSchema,
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

export const CommandEventSchema = z.discriminatedUnion("type", [
  HallUpgradedEventSchema,
  TavernRefreshedEventSchema,
  HeroRecruitedEventSchema,
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
]);

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  code: ApiErrorCodeSchema,
  message: z.string().min(1),
  currentVersion: z.number().int().nonnegative().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
