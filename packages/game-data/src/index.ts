import { z } from "zod";

export const GameConfigSchema = z.object({
  version: z.string().min(1),
  starterGold: z.number().int().nonnegative(),
  offlineCapHours: z.number().int().positive(),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

export const foundationConfig = GameConfigSchema.parse({
  version: "m0",
  starterGold: 100,
  offlineCapHours: 8,
});
