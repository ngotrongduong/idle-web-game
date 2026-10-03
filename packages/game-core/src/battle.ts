import { fnv1a32 } from "./hash";
import { SeededRng } from "./rng";

export type Combatant = {
  id: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  critBps?: number;
};

export type BattleRules = {
  maxTurns: number;
  defenseK: number;
  varianceMinBps: number;
  varianceMaxBps: number;
  defaultCritBps: number;
  critMultiplierBps: number;
};

export type BattleEvent = {
  turn: number;
  actorId: string;
  targetId: string;
  damage: number;
  critical: boolean;
  targetHp: number;
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
};

type RuntimeUnit = Combatant & {
  currentHp: number;
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
}

function compareIds(left: RuntimeUnit, right: RuntimeUnit): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function living(units: RuntimeUnit[]): RuntimeUnit[] {
  return units.filter((unit) => unit.currentHp > 0);
}

function calculateDamage(
  attacker: RuntimeUnit,
  defender: RuntimeUnit,
  rng: SeededRng,
  rules: BattleRules,
): { damage: number; critical: boolean } {
  const base = Math.max(
    1,
    Math.floor(
      (attacker.attack * rules.defenseK) /
        (rules.defenseK + defender.defense),
    ),
  );

  const varianceRange =
    rules.varianceMaxBps - rules.varianceMinBps + 1;
  const varianceBps =
    rules.varianceMinBps + rng.nextInt(varianceRange);

  let damage = Math.max(1, Math.floor((base * varianceBps) / BPS));
  const critical =
    rng.nextInt(BPS) < (attacker.critBps ?? rules.defaultCritBps);

  if (critical) {
    damage = Math.max(
      1,
      Math.floor((damage * rules.critMultiplierBps) / BPS),
    );
  }

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

  const rng = new SeededRng(input.seed);
  const allies: RuntimeUnit[] = input.allies.map((unit) => ({
    ...unit,
    currentHp: unit.hp,
    side: "ally",
  }));
  const enemies: RuntimeUnit[] = input.enemies.map((unit) => ({
    ...unit,
    currentHp: unit.hp,
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
      const targets = living(opponents).sort(compareIds);
      if (targets.length === 0) break;

      const target = targets[rng.nextInt(targets.length)]!;
      const { damage, critical } = calculateDamage(
        actor,
        target,
        rng,
        rules,
      );

      target.currentHp = Math.max(0, target.currentHp - damage);
      turns += 1;
      events.push({
        turn: turns,
        actorId: actor.id,
        targetId: target.id,
        damage,
        critical,
        targetHp: target.currentHp,
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
