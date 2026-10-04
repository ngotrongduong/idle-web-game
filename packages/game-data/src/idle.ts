import { z } from "zod";
import rawIdleConfig from "../data/idle.json" with { type: "json" };

export const IdleConfigSchema = z.object({
  cycleDurationSeconds: z.number().int().positive(),
  offlineCapHours: z.number().int().positive().max(24),
  offlineEfficiencyBps: z.number().int().min(1).max(10_000),
});

export type IdleConfig = z.infer<typeof IdleConfigSchema>;

export const idleConfig = IdleConfigSchema.parse(rawIdleConfig);
