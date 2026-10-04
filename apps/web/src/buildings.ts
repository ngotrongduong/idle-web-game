/**
 * Display helpers for the M1.7 buildings UI. The server decides every outcome; these functions only
 * turn catalog data and server timestamps into what the screen shows (countdowns, disabled reasons).
 */
import { t } from "@idle/i18n";

export type BuildingId = "hall" | "forge";

export type Construction = {
  building: BuildingId;
  targetLevel: number;
  startedAt: string;
  completesAt: string;
};

export type BuildingState = {
  hallLevel: number;
  forgeLevel: number;
  construction: Construction | null;
};

export type MaterialCost = {
  materialId: string;
  qty: number;
};

export type HallLevel = {
  level: number;
  heroCapacity: number;
  teamLimit: number;
  upgradeGoldCost: number | null;
  buildSeconds: number | null;
  upgradeMaterials: MaterialCost[];
};

export type ForgeLevel = {
  level: number;
  maxEnhanceLevel: number;
  qualityWeightsBps: number[];
  upgradeGoldCost: number | null;
  buildSeconds: number | null;
  upgradeMaterials: MaterialCost[];
};

export type BuildingRules = {
  speedUpMaterialId: string;
  speedUpSecondsPerItem: number;
};

export type QualityTier = {
  id: string;
  nameVi: string;
  nameEn: string;
  weightBps: number;
  multiplierBps: number;
  dismantleDust: number;
};

/** Server clock minus device clock, measured when a response carrying `serverTime` arrives. */
export function clockOffsetMs(serverTime: string, localNowMs: number): number {
  const serverMs = Date.parse(serverTime);
  return Number.isFinite(serverMs) ? serverMs - localNowMs : 0;
}

/** Milliseconds until the build completes on the server clock; never negative. */
export function remainingBuildMs(construction: Construction, serverNowMs: number): number {
  const completesAtMs = Date.parse(construction.completesAt);
  if (!Number.isFinite(completesAtMs)) return 0;
  return Math.max(0, completesAtMs - serverNowMs);
}

/** Share of the build that is done, 0..1. A sped-up build keeps its start and ends sooner. */
export function constructionProgress(construction: Construction, serverNowMs: number): number {
  const startedAtMs = Date.parse(construction.startedAt);
  const completesAtMs = Date.parse(construction.completesAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(completesAtMs)) return 0;
  if (completesAtMs <= startedAtMs) return 1;
  const done = (serverNowMs - startedAtMs) / (completesAtMs - startedAtMs);
  return Math.min(1, Math.max(0, done));
}

/** `m:ss` under an hour, `h:mm:ss` from one hour; a partial second counts as a whole one. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.ceil(totalSeconds)) : 0;
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** Speed-up items that finish the build right now; 0 when nothing is left to skip. */
export function speedUpItemsNeeded(remainingMs: number, secondsPerItem: number): number {
  if (!(remainingMs > 0) || !(secondsPerItem > 0)) return 0;
  return Math.ceil(remainingMs / (secondsPerItem * 1_000));
}

/** Basis points as a percentage without trailing zeros: 7000 → "70%", 450 → "4.5%". */
export function formatBps(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

export type UpgradeBlock = "max_level" | "builder_busy" | "gold" | "materials";

/** Why an upgrade cannot start, in the order the server checks; null when it can. */
export function upgradeBlock(input: {
  goldCost: number | null;
  materials: readonly MaterialCost[];
  gold: number;
  owned: (materialId: string) => number;
  builderBusy: boolean;
}): UpgradeBlock | null {
  if (input.goldCost === null) return "max_level";
  if (input.builderBusy) return "builder_busy";
  if (input.gold < input.goldCost) return "gold";
  if (input.materials.some((entry) => input.owned(entry.materialId) < entry.qty)) {
    return "materials";
  }
  return null;
}

/** Lowest Forge level that can enhance an item currently at `enhanceLevel`; null if none can. */
export function forgeLevelForEnhance(
  forge: readonly ForgeLevel[],
  enhanceLevel: number,
): number | null {
  const levels = forge
    .filter((entry) => entry.maxEnhanceLevel > enhanceLevel)
    .map((entry) => entry.level);
  return levels.length ? Math.min(...levels) : null;
}

export type EnhanceBlock = "max_level" | "forge" | "gold" | "dust";

/** Why Enhance is disabled, in the order the server checks; null when the attempt can be made. */
export function enhanceBlock(input: {
  enhanceLevel: number;
  maxEnhanceLevel: number;
  forgeCap: number;
  goldCost: number | undefined;
  dustCost: number | undefined;
  gold: number;
  dust: number;
}): EnhanceBlock | null {
  if (input.enhanceLevel >= input.maxEnhanceLevel || input.goldCost === undefined) {
    return "max_level";
  }
  if (input.enhanceLevel >= input.forgeCap) return "forge";
  if (input.gold < input.goldCost) return "gold";
  if (input.dust < (input.dustCost ?? 0)) return "dust";
  return null;
}

/** Forge Dust shown on the Dismantle button: the yield of the best quality tier the item reaches. */
export function dismantleDustFor(qualityBps: number, tiers: readonly QualityTier[]): number {
  let best = tiers[0];
  if (!best) return 0;
  for (const tier of tiers) {
    if (tier.multiplierBps <= qualityBps && tier.multiplierBps > best.multiplierBps) best = tier;
  }
  return best.dismantleDust;
}

/**
 * Craft odds of one Forge level, e.g. "Thường 70% · Tinh xảo 25%". `weightsBps` is in quality-tier
 * order; without it the tiers' base (Forge level 1) weights are shown.
 */
export function oddsLabel(
  tiers: readonly QualityTier[],
  weightsBps: readonly number[] | undefined,
): string {
  return tiers
    .map((tier, index) => `${tier.nameVi} ${formatBps(weightsBps?.[index] ?? tier.weightBps)}`)
    .join(" · ");
}

/** "+2" for a Forge that enhances up to +2; the locked label while enhancement is not open. */
export function enhanceCapLabel(maxEnhanceLevel: number): string {
  return maxEnhanceLevel > 0 ? `+${maxEnhanceLevel}` : t("vi", "forge.enhanceLocked");
}

function sameConstruction(left: Construction | null, right: Construction | null): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.building === right.building &&
    left.targetLevel === right.targetLevel &&
    left.startedAt === right.startedAt &&
    left.completesAt === right.completesAt
  );
}

/**
 * Merges the server's building levels into the player state. Returns the same object when nothing
 * changed, so a poll that finds no news does not re-render the app.
 */
export function applyBuildingState<T extends BuildingState>(current: T, next: BuildingState): T {
  if (
    current.hallLevel === next.hallLevel &&
    current.forgeLevel === next.forgeLevel &&
    sameConstruction(current.construction, next.construction)
  ) {
    return current;
  }
  return {
    ...current,
    hallLevel: next.hallLevel,
    forgeLevel: next.forgeLevel,
    construction: next.construction,
  };
}
