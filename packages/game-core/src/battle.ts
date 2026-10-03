import { fnv1a32 } from "./hash.js";
import { SeededRng } from "./rng.js";

export type TargetingMode = "random" | "lowest_hp" | "highest_attack";
export type BattleAction = "basic" | "ultimate";

export type Combatant = {
  id: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  critBps?: number;
  familyId?: string;
  targeting?: TargetingMode;
  ultimatePowerBps?: number;
  startingMp?: number;
};

export type BattleRules = {
  maxTurns: number;
  defenseK: number;
  varianceMinBps: number;
  varianceMaxBps: number;
  defaultCritBps: number;
  critMultiplierBps: number;
  mpMax: number;
  mpPerAction: number;
  mpOnHit: number;
  familyAdvantage: Record<string, string>;
  advantageMultiplierBps: number;
  disadvantageMultiplierBps: number;
};

export type BattleEvent = {
  turn: number;
  actorId: string;
  targetId: string;
  damage: number;
  critical: boolean;
  targetHp: number;
  action: BattleAction;
};

export type BattleResult = {
  result: "win" | "lose" | "draw";
  turns: number;
  events: BattleEvent[];
  hash: string;
};

const BPS = 10_000;

export const DEFAULT_BATTLE_RULES: BattleRules = {
  maxTurns: 60,
  defenseK: 100,
  varianceMinBps: 9_000,
  varianceMaxBps: 11_000,
  defaultCritBps: 1_000,
  critMultiplierBps: 20_000,
  mpMax: 100,
  mpPerAction: 10,
  mpOnHit: 5,
  familyAdvantage: {},
  advantageMultiplierBps: 12_000,
  disadvantageMultiplierBps: 8_500,
};

type RuntimeUnit = Combatant & {
  currentHp: number;
  currentMp: number;
  side: "ally" | "enemy";
};

function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertNonNegativeInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function validateCombatant(unit: Combatant): void {
  if (!unit.id) throw new Error("Combatant id is required");
  assertPositiveInt(unit.hp, `${unit.id}.hp`);
  assertPositiveInt(unit.attack, `${unit.id}.attack`);
  assertNonNegativeInt(unit.defense, `${unit.id}.defense`);
  assertNonNegativeInt(unit.speed, `${unit.id}.speed`);

  if (unit.critBps !== undefined) {
    assertNonNegativeInt(unit.critBps, `${unit.id}.critBps`);
    if (unit.critBps > BPS) {
      throw new Error(`${unit.id}.critBps must be <= ${BPS}`);
    }
  }

  if (unit.ultimatePowerBps !== undefined) {
    assertPositiveInt(unit.ultimatePowerBps, `${unit.id}.ultimatePowerBps`);
  }

  if (unit.startingMp !== undefined) {
    assertNonNegativeInt(unit.startingMp, `${unit.id}.startingMp`);
  }
}

function validateRules(rules: BattleRules): void {
  assertPositiveInt(rules.maxTurns, "rules.maxTurns");
  assertPositiveInt(rules.defenseK, "rules.defenseK");
  assertPositiveInt(rules.varianceMinBps, "rules.varianceMinBps");
  assertPositiveInt(rules.varianceMaxBps, "rules.varianceMaxBps");
  if (rules.varianceMaxBps < rules.varianceMinBps) {
    throw new Error("varianceMaxBps must be >= varianceMinBps");
  }

  assertNonNegativeInt(rules.defaultCritBps, "rules.defaultCritBps");
  if (rules.defaultCritBps > BPS) {
    throw new Error(`defaultCritBps must be <= ${BPS}`);
  }

  assertPositiveInt(rules.critMultiplierBps, "rules.critMultiplierBps");
  assertPositiveInt(rules.mpMax, "rules.mpMax");
  assertNonNegativeInt(rules.mpPerAction, "rules.mpPerAction");
  assertNonNegativeInt(rules.mpOnHit, "rules.mpOnHit");
  assertPositiveInt(
    rules.advantageMultiplierBps,
    "rules.advantageMultiplierBps",
  );
  assertPositiveInt(
    rules.disadvantageMultiplierBps,
    "rules.disadvantageMultiplierBps",
  );
}

function compareIds(left: RuntimeUnit, right: RuntimeUnit): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function living(units: RuntimeUnit[]): RuntimeUnit[] {
  return units.filter((unit) => unit.currentHp > 0);
}

function selectTarget(
  actor: RuntimeUnit,
  targets: RuntimeUnit[],
  rng: SeededRng,
): RuntimeUnit {
  if (actor.targeting === "lowest_hp") {
    return [...targets].sort(
      (left, right) =>
        left.currentHp - right.currentHp || compareIds(left, right),
    )[0]!;
  }

  if (actor.targeting === "highest_attack") {
    return [...targets].sort(
      (left, right) =>
        right.attack - left.attack || compareIds(left, right),
    )[0]!;
  }

  const stableTargets = [...targets].sort(compareIds);
  return stableTargets[rng.nextInt(stableTargets.length)]!;
}

function familyMultiplierBps(
  attacker: RuntimeUnit,
  defender: RuntimeUnit,
  rules: BattleRules,
): number {
  if (!attacker.familyId || !defender.familyId) return BPS;

  if (rules.familyAdvantage[attacker.familyId] === defender.familyId) {
    return rules.advantageMultiplierBps;
  }

  if (rules.familyAdvantage[defender.familyId] === attacker.familyId) {
    return rules.disadvantageMultiplierBps;
  }

  return BPS;
}

function calculateDamage(
  attacker: RuntimeUnit,
  defender: RuntimeUnit,
  rng: SeededRng,
  rules: BattleRules,
  powerBps: number,
): { damage: number; critical: boolean } {
  const base = Math.max(
    1,
    Math.floor(
      (attacker.attack * rules.defenseK) /
        (rules.defenseK + defender.defense),
    ),
  );

  const varianceRange = rules.varianceMaxBps - rules.varianceMinBps + 1;
  const varianceBps = rules.varianceMinBps + rng.nextInt(varianceRange);

  let damage = Math.max(1, Math.floor((base * varianceBps) / BPS));
  damage = Math.max(1, Math.floor((damage * powerBps) / BPS));

  const critical =
    rng.nextInt(BPS) < (attacker.critBps ?? rules.defaultCritBps);

  if (critical) {
    damage = Math.max(
      1,
      Math.floor((damage * rules.critMultiplierBps) / BPS),
    );
  }

  damage = Math.max(
    1,
    Math.floor(
      (damage * familyMultiplierBps(attacker, defender, rules)) / BPS,
    ),
  );

  return { damage, critical };
}

function hashBattle(
  result: BattleResult["result"],
  turns: number,
  events: BattleEvent[],
): string {
  const serializedEvents = events
    .map(
      (event) =>
        `${event.turn},${event.actorId},${event.targetId},${event.damage},${event.critical ? 1 : 0},${event.targetHp}`,
    )
    .join(";");

  return fnv1a32(`${result}|${turns}|${serializedEvents}`);
}

export function scaleStat(
  base: number,
  level: number,
  growthBpsPerLevel: number,
): number {
  assertPositiveInt(base, "base");
  assertPositiveInt(level, "level");
  assertNonNegativeInt(growthBpsPerLevel, "growthBpsPerLevel");

  const multiplierBps = BPS + (level - 1) * growthBpsPerLevel;
  return Math.floor((base * multiplierBps) / BPS);
}

export function simulateWave(input: {
  allies: Combatant[];
  enemies: Combatant[];
  seed: number;
  rules?: Partial<BattleRules>;
}): BattleResult {
  if (input.allies.length === 0 || input.enemies.length === 0) {
    throw new Error("simulateWave requires at least one ally and one enemy");
  }

  input.allies.forEach(validateCombatant);
  input.enemies.forEach(validateCombatant);

  const ids = [...input.allies, ...input.enemies].map((unit) => unit.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Combatant ids must be unique within a wave");
  }

  const rules: BattleRules = {
    ...DEFAULT_BATTLE_RULES,
    ...input.rules,
  };
  validateRules(rules);

  for (const unit of [...input.allies, ...input.enemies]) {
    if ((unit.startingMp ?? 0) > rules.mpMax) {
      throw new Error(`${unit.id}.startingMp must be <= rules.mpMax`);
    }
  }

  const rng = new SeededRng(input.seed);
  const allies: RuntimeUnit[] = input.allies.map((unit) => ({
    ...unit,
    currentHp: unit.hp,
    currentMp: unit.startingMp ?? 0,
    side: "ally",
  }));
  const enemies: RuntimeUnit[] = input.enemies.map((unit) => ({
    ...unit,
    currentHp: unit.hp,
    currentMp: unit.startingMp ?? 0,
    side: "enemy",
  }));

  const events: BattleEvent[] = [];
  let turns = 0;

  while (
    living(allies).length > 0 &&
    living(enemies).length > 0 &&
    turns < rules.maxTurns
  ) {
    const order = [...living(allies), ...living(enemies)].sort(
      (left, right) => right.speed - left.speed || compareIds(left, right),
    );

    for (const actor of order) {
      if (turns >= rules.maxTurns) break;
      if (actor.currentHp <= 0) continue;

      const opponents = actor.side === "ally" ? enemies : allies;
      const targets = living(opponents);
      if (targets.length === 0) break;

      const target = selectTarget(actor, targets, rng);
      const canUseUltimate =
        actor.ultimatePowerBps !== undefined && actor.currentMp >= rules.mpMax;
      const action: BattleAction = canUseUltimate ? "ultimate" : "basic";
      const powerBps = canUseUltimate ? actor.ultimatePowerBps! : BPS;

      const { damage, critical } = calculateDamage(
        actor,
        target,
        rng,
        rules,
        powerBps,
      );

      target.currentHp = Math.max(0, target.currentHp - damage);

      if (actor.ultimatePowerBps !== undefined) {
        actor.currentMp = canUseUltimate
          ? 0
          : Math.min(rules.mpMax, actor.currentMp + rules.mpPerAction);
      }

      if (target.ultimatePowerBps !== undefined) {
        target.currentMp = Math.min(
          rules.mpMax,
          target.currentMp + rules.mpOnHit,
        );
      }

      turns += 1;
      events.push({
        turn: turns,
        actorId: actor.id,
        targetId: target.id,
        damage,
        critical,
        targetHp: target.currentHp,
        action,
      });

      if (living(allies).length === 0 || living(enemies).length === 0) {
        break;
      }
    }
  }

  const alliesAlive = living(allies).length > 0;
  const enemiesAlive = living(enemies).length > 0;
  const result: BattleResult["result"] =
    alliesAlive && !enemiesAlive
      ? "win"
      : enemiesAlive && !alliesAlive
        ? "lose"
        : "draw";

  return {
    result,
    turns,
    events,
    hash: hashBattle(result, turns, events),
  };
}
