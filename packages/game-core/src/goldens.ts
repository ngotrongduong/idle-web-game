import type { BattleRules, Combatant } from "./battle.js";

/**
 * Fixed battles whose hashes are pinned in Node tests and in Chromium (browser-golden.html), so the
 * engine stays bit-identical across runtimes. v1 is the original M0 scenario with default rules.
 */
export const GOLDEN_V1 = {
  seed: 123456,
  allies: [
    { id: "warrior", hp: 180, attack: 42, defense: 28, speed: 12, critBps: 1000 },
    { id: "mage", hp: 110, attack: 55, defense: 12, speed: 15, critBps: 1400 },
  ] satisfies Combatant[],
  enemies: [
    { id: "slime_a", hp: 95, attack: 25, defense: 10, speed: 8, critBps: 500 },
    { id: "slime_b", hp: 105, attack: 27, defense: 12, speed: 9, critBps: 500 },
  ] satisfies Combatant[],
};

/** Formula v2 (docs/03 §3) with levels, 50% starting MP, a damage ULT and a heal ULT. */
export const GOLDEN_V2_RULES: Partial<BattleRules> = {
  formulaVersion: 2,
  maxTurns: 150,
  defenseK: 60,
  defenseKBase: 60,
  defenseKPerLevel: 8,
  varianceMinBps: 9_500,
  varianceMaxBps: 10_500,
  defaultCritBps: 500,
  critMultiplierBps: 15_000,
  critCapBps: 7_500,
  mpMax: 100,
  mpPerAction: 10,
  mpOnHit: 5,
  familyAdvantage: { ironbound: "windstrider" },
  advantageMultiplierBps: 12_000,
  disadvantageMultiplierBps: 8_500,
};

export const GOLDEN_V2 = {
  seed: 20261006,
  allies: [
    {
      id: "guard",
      level: 8,
      hp: 420,
      attack: 61,
      defense: 52,
      speed: 18,
      critBps: 500,
      familyId: "ironbound",
      targeting: "random",
      ultimatePowerBps: 13_500,
      ultimateKind: "damage",
      ultimateTargeting: "highest_attack",
      startingMp: 50,
    },
    {
      id: "acolyte",
      level: 8,
      hp: 300,
      attack: 48,
      defense: 30,
      speed: 20,
      critBps: 500,
      familyId: "dawn_warden",
      targeting: "random",
      ultimatePowerBps: 15_000,
      ultimateKind: "heal",
      ultimateTargeting: "lowest_hp",
      startingMp: 50,
    },
    {
      id: "archer",
      level: 8,
      hp: 280,
      attack: 70,
      defense: 26,
      speed: 24,
      critBps: 1_000,
      familyId: "windstrider",
      targeting: "lowest_hp",
      ultimatePowerBps: 16_000,
      ultimateKind: "damage",
      ultimateTargeting: "lowest_hp",
      startingMp: 50,
    },
  ] satisfies Combatant[],
  enemies: [
    {
      id: "brute",
      level: 10,
      hp: 520,
      attack: 58,
      defense: 40,
      speed: 16,
      familyId: "windstrider",
    },
    { id: "skirmisher", level: 10, hp: 360, attack: 66, defense: 22, speed: 22 },
  ] satisfies Combatant[],
};
