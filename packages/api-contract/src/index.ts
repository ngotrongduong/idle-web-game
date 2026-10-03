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

export type FoundationPlayerState = z.infer<
  typeof FoundationPlayerStateSchema
>;

export const GuestAuthResponseSchema = z.object({
  ok: z.literal(true),
  state: FoundationPlayerStateSchema,
});

export const UpgradeHallCommandSchema = z.object({
  type: z.literal("upgrade_hall"),
});

export const CommandSchema = UpgradeHallCommandSchema;

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

export const CommandEventSchema = z.object({
  type: z.literal("hall_upgraded"),
  fromLevel: z.number().int().min(1).max(9),
  toLevel: z.number().int().min(2).max(10),
  goldCost: z.number().int().positive(),
});

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
]);

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  code: ApiErrorCodeSchema,
  message: z.string().min(1),
  currentVersion: z.number().int().nonnegative().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
