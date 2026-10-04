import { z } from "zod";
import rawBuildingsConfig from "../data/buildings.json" with { type: "json" };
import { equipmentConfig, type CraftQualityTier } from "./equipment.js";
import type { GameData } from "./schema.js";

export const BuildingIdSchema = z.enum(["hall", "forge"]);
export type BuildingId = z.infer<typeof BuildingIdSchema>;

const UpgradeMaterialSchema = z.object({
  materialId: z.string().min(1),
  qty: z.number().int().positive(),
});

/** Every array is indexed by the level being left: index 0 is the upgrade from level 1 to 2. */
const BuildingUpgradeSchema = z.object({
  upgradeGoldCost: z.array(z.number().int().positive()),
  buildSeconds: z.array(z.number().int().positive()),
  upgradeMaterials: z.array(z.array(UpgradeMaterialSchema)),
});

export const BuildingsConfigSchema = z.object({
  maxLevel: z.number().int().min(2).max(10),
  speedUp: z.object({
    materialId: z.string().min(1),
    secondsPerItem: z.number().int().positive(),
  }),
  hall: BuildingUpgradeSchema,
  forge: BuildingUpgradeSchema.extend({
    /** Highest enhancement level the Forge allows; index 0 is Forge level 1. */
    maxEnhanceLevel: z.array(z.number().int().nonnegative()),
    /** Craft quality weights per Forge level, in `equipmentConfig.qualityTiers` order. */
    qualityWeightsBps: z.array(z.array(z.number().int().min(0).max(10_000))),
  }),
});

export type BuildingsConfig = z.infer<typeof BuildingsConfigSchema>;
export type BuildingUpgrade = {
  goldCost: number;
  buildSeconds: number;
  materials: { materialId: string; qty: number }[];
};

export function validateBuildingsConfig(input: unknown): BuildingsConfig {
  const config = BuildingsConfigSchema.parse(input);
  const steps = config.maxLevel - 1;

  for (const id of BuildingIdSchema.options) {
    const building = config[id];
    if (
      building.upgradeGoldCost.length !== steps ||
      building.buildSeconds.length !== steps ||
      building.upgradeMaterials.length !== steps
    ) {
      throw new Error(`buildings.json ${id} must list ${steps} upgrade steps`);
    }
    for (const materials of building.upgradeMaterials) {
      // Upgrades charge each line against the starting balance, so a repeated material would
      // only be paid once.
      const ids = materials.map((entry) => entry.materialId);
      if (new Set(ids).size !== ids.length) {
        throw new Error(`buildings.json ${id} lists an upgrade material more than once`);
      }
    }
  }

  const { maxEnhanceLevel, qualityWeightsBps } = config.forge;
  if (maxEnhanceLevel.length !== config.maxLevel || qualityWeightsBps.length !== config.maxLevel) {
    throw new Error(`buildings.json forge must list ${config.maxLevel} levels`);
  }
  maxEnhanceLevel.forEach((cap, index) => {
    if (cap > equipmentConfig.maxEnhanceLevel) {
      throw new Error(`Forge enhancement cap ${cap} exceeds the equipment maximum`);
    }
    if (index > 0 && cap < maxEnhanceLevel[index - 1]!) {
      throw new Error("Forge enhancement caps must never decrease with the Forge level");
    }
  });
  if (maxEnhanceLevel.at(-1) !== equipmentConfig.maxEnhanceLevel) {
    throw new Error("A maximum-level Forge must allow the maximum enhancement level");
  }

  const tierCount = equipmentConfig.qualityTiers.length;
  for (const weights of qualityWeightsBps) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (weights.length !== tierCount || total !== 10_000) {
      throw new Error(`Forge quality weights need ${tierCount} entries totalling 10000 bps`);
    }
  }
  const baseWeights = equipmentConfig.qualityTiers.map((tier) => tier.weightBps);
  if (qualityWeightsBps[0]!.some((weight, index) => weight !== baseWeights[index])) {
    throw new Error("Forge level 1 quality weights must equal the base craft quality weights");
  }

  return config;
}

export const buildingsConfig = validateBuildingsConfig(rawBuildingsConfig);

/** Fails when a building or the speed-up item points at a material that does not exist. */
export function assertBuildingMaterialsExist(config: BuildingsConfig, gameData: GameData): void {
  const materialIds = new Set(gameData.materials.map((entry) => entry.id));
  const referenced = [
    config.speedUp.materialId,
    ...BuildingIdSchema.options.flatMap((id) =>
      config[id].upgradeMaterials.flat().map((entry) => entry.materialId),
    ),
  ];
  for (const materialId of referenced) {
    if (!materialIds.has(materialId)) {
      throw new Error(`buildings.json references missing material ${materialId}`);
    }
  }
}

function assertBuildingLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > buildingsConfig.maxLevel) {
    throw new Error(`building level must be an integer between 1 and ${buildingsConfig.maxLevel}`);
  }
}

/** Cost and duration of the upgrade that leaves `currentLevel`; null at the maximum level. */
export function buildingUpgrade(
  building: BuildingId,
  currentLevel: number,
): BuildingUpgrade | null {
  assertBuildingLevel(currentLevel);
  if (currentLevel >= buildingsConfig.maxLevel) return null;

  const config = buildingsConfig[building];
  const index = currentLevel - 1;
  return {
    goldCost: config.upgradeGoldCost[index]!,
    buildSeconds: config.buildSeconds[index]!,
    materials: config.upgradeMaterials[index]!.map((entry) => ({ ...entry })),
  };
}

export function forgeMaxEnhanceLevel(forgeLevel: number): number {
  assertBuildingLevel(forgeLevel);
  return buildingsConfig.forge.maxEnhanceLevel[forgeLevel - 1]!;
}

/** The craft quality tiers with the odds of the given Forge level. */
export function forgeQualityTiers(forgeLevel: number): CraftQualityTier[] {
  assertBuildingLevel(forgeLevel);
  const weights = buildingsConfig.forge.qualityWeightsBps[forgeLevel - 1]!;
  return equipmentConfig.qualityTiers.map((tier, index) => ({
    ...tier,
    weightBps: weights[index]!,
  }));
}
