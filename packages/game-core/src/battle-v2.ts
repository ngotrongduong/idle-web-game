import {
  DEFAULT_BATTLE_RULES,
  type BattleRules,
  type Combatant,
} from "./battle";
import { fnv1a32 } from "./hash";
import { SeededRng } from "./rng";

const BPS = 10_000;
export const MP_MAX = 100;
export const MP_PER_TURN = 10;
export const MP_ON_HIT = 5;

export type CombatSkillEffect =
  | "damage_single"
  | "damage_aoe"
  | "heal_single"
  | "heal_aoe"
  | "shield_allies";

export type CombatSkillTarget =
  | "lowest_hp_enemy"
  | "all_enemies"
  | "lowest_hp_ally"
  | "all_allies";

export type CombatSkill = {
  id: string;
  effect: CombatSkillEffect;
  target: CombatSkillTarget;
  powerBps: number;
};

export type CombatPassive = {
  stat: "hp" | "attack" | "defense" | "speed";
  bonusBps: number;
};

export type CombatantV2 = Combatant & {
  ult?: CombatSkill;
  passive?: CombatPassive;
};

export type BattleActionV2 =
  | "basic_attack"
  | "ult_damage"
  | "ult_heal"
  | "ult_shield";

export type BattleEventV2 = {
  turn: number;
  action: BattleActionV2;
  actorId: string;
  targetId: string;
  skillId: string | null;
  amount: number;
  critical: boolean;
  targetHp: number;
  targetShield: number;
  actorMp: number;
  targetMp: number;
};

export type BattleUnitStateV2 = {
  id: string;
  currentHp: number;
  mp: number;
  shield: number;
};

export type BattleResultV2 = {
  rulesVersion: "v2";
  result: "win" | "lose" | "draw";
  turns: number;
  events: BattleEventV2[];
  hash: string;
  finalAllies: BattleUnitStateV2[];
  finalEnemies: BattleUnitStateV2[];
};

type RuntimeUnitV2 = {
  id: string;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  speed: number;
  critBps?: number;
  mp: number;
  shield: number;
  side: "ally" | "enemy";
  ult?: CombatSkill;
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

function validateSkill(skill: CombatSkill, unitId: string): void {
  if (!skill.id) throw new Error(`${unitId}.ult.id is required`);
  assertPositiveInt(skill.powerBps, `${unitId}.ult.powerBps`);

  const expectedTarget: Record<CombatSkillEffect, CombatSkillTarget> = {
    damage_single: "lowest_hp_enemy",
    damage_aoe: "all_enemies",
    heal_single: "lowest_hp_ally",
    heal_aoe: "all_allies",
    shield_allies: "all_allies",
  };

  if (skill.target !== expectedTarget[skill.effect]) {
    throw new Error(
      `${unitId}.ult target ${skill.target} does not match effect ${skill.effect}`,
    );
  }
}

function validateCombatant(unit: CombatantV2): void {
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

  if (unit.passive) {
    assertNonNegativeInt(
      unit.passive.bonusBps,
      `${unit.id}.passive.bonusBps`,
    );
  }

  if (unit.ult) validateSkill(unit.ult, unit.id);
}

function applyBps(value: number, bonusBps: number): number {
  return Math.max(1, Math.floor((value * (BPS + bonusBps)) / BPS));
}

function toRuntime(
  input: CombatantV2,
  side: RuntimeUnitV2["side"],
): RuntimeUnitV2 {
  let maxHp = input.hp;
  let attack = input.attack;
  let defense = input.defense;
  let speed = input.speed;

  if (input.passive) {
    if (input.passive.stat === "hp") {
      maxHp = applyBps(maxHp, input.passive.bonusBps);
    } else if (input.passive.stat === "attack") {
      attack = applyBps(attack, input.passive.bonusBps);
    } else if (input.passive.stat === "defense") {
      defense = applyBps(defense, input.passive.bonusBps);
    } else {
      speed = applyBps(speed, input.passive.bonusBps);
    }
  }

  return {
    id: input.id,
    maxHp,
    currentHp: maxHp,
    attack,
    defense,
    speed,
    ...(input.critBps === undefined ? {} : { critBps: input.critBps }),
    mp: 0,
    shield: 0,
    side,
    ...(input.ult === undefined ? {} : { ult: input.ult }),
  };
}

function compareIds(left: RuntimeUnitV2, right: RuntimeUnitV2): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function living(units: RuntimeUnitV2[]): RuntimeUnitV2[] {
  return units.filter((unit) => unit.currentHp > 0);
}

function snapshotUnit(unit: RuntimeUnitV2): BattleUnitStateV2 {
  return {
    id: unit.id,
    currentHp: unit.currentHp,
    mp: unit.mp,
    shield: unit.shield,
  };
}

function restoreInitialState(
  units: RuntimeUnitV2[],
  states: BattleUnitStateV2[],
): void {
  if (states.length !== units.length) {
    throw new Error("initialAllies must contain one state for every ally");
  }

  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const seen = new Set<string>();

  for (const state of states) {
    if (seen.has(state.id)) {
      throw new Error(`Duplicate initial ally state: ${state.id}`);
    }
    seen.add(state.id);

    const unit = byId.get(state.id);
    if (!unit) {
      throw new Error(`Unknown initial ally state: ${state.id}`);
    }

    assertNonNegativeInt(state.currentHp, `${state.id}.currentHp`);
    assertNonNegativeInt(state.mp, `${state.id}.mp`);
    assertNonNegativeInt(state.shield, `${state.id}.shield`);

    if (state.currentHp > unit.maxHp) {
      throw new Error(`${state.id}.currentHp exceeds max HP`);
    }
    if (state.mp > MP_MAX) {
      throw new Error(`${state.id}.mp exceeds ${MP_MAX}`);
    }

    unit.currentHp = state.currentHp;
    unit.mp = state.mp;
    unit.shield = state.shield;
  }
}

function compareLowestHpRatio(
  left: RuntimeUnitV2,
  right: RuntimeUnitV2,
): number {
  const leftScaled = left.currentHp * right.maxHp;
  const rightScaled = right.currentHp * left.maxHp;
  return leftScaled - rightScaled || compareIds(left, right);
}

function calculateDamage(
  attacker: RuntimeUnitV2,
  defender: RuntimeUnitV2,
  powerBps: number,
  rng: SeededRng,
  rules: BattleRules,
): { damage: number; critical: boolean } {
  const defendedBase = Math.max(
    1,
    Math.floor(
      (attacker.attack * rules.defenseK) /
        (rules.defenseK + defender.defense),
    ),
  );
  const poweredBase = Math.max(
    1,
    Math.floor((defendedBase * powerBps) / BPS),
  );

  const varianceRange =
    rules.varianceMaxBps - rules.varianceMinBps + 1;
  const varianceBps =
    rules.varianceMinBps + rng.nextInt(varianceRange);

  let damage = Math.max(
    1,
    Math.floor((poweredBase * varianceBps) / BPS),
  );
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

function applyDamage(
  target: RuntimeUnitV2,
  damage: number,
): void {
  const absorbed = Math.min(target.shield, damage);
  target.shield -= absorbed;
  const hpDamage = damage - absorbed;
  target.currentHp = Math.max(0, target.currentHp - hpDamage);
  target.mp = Math.min(MP_MAX, target.mp + MP_ON_HIT);
}

function actionForEffect(
  effect: CombatSkillEffect,
): BattleActionV2 {
  if (effect === "damage_single" || effect === "damage_aoe") {
    return "ult_damage";
  }
  if (effect === "heal_single" || effect === "heal_aoe") {
    return "ult_heal";
  }
  return "ult_shield";
}

function serializeEvent(event: BattleEventV2): string {
  return [
    event.turn,
    event.action,
    event.actorId,
    event.targetId,
    event.skillId ?? "",
    event.amount,
    event.critical ? 1 : 0,
    event.targetHp,
    event.targetShield,
    event.actorMp,
    event.targetMp,
  ].join(",");
}

function hashBattleV2(
  result: BattleResultV2["result"],
  turns: number,
  events: BattleEventV2[],
): string {
  return fnv1a32(
    `v2|${result}|${turns}|${events.map(serializeEvent).join(";")}`,
  );
}

function pushDamageEvent(input: {
  events: BattleEventV2[];
  turn: number;
  action: BattleActionV2;
  actor: RuntimeUnitV2;
  target: RuntimeUnitV2;
  skillId: string | null;
  powerBps: number;
  rng: SeededRng;
  rules: BattleRules;
}): void {
  const { damage, critical } = calculateDamage(
    input.actor,
    input.target,
    input.powerBps,
    input.rng,
    input.rules,
  );
  applyDamage(input.target, damage);

  input.events.push({
    turn: input.turn,
    action: input.action,
    actorId: input.actor.id,
    targetId: input.target.id,
    skillId: input.skillId,
    amount: damage,
    critical,
    targetHp: input.target.currentHp,
    targetShield: input.target.shield,
    actorMp: input.actor.mp,
    targetMp: input.target.mp,
  });
}

function useUlt(input: {
  actor: RuntimeUnitV2;
  allies: RuntimeUnitV2[];
  enemies: RuntimeUnitV2[];
  turn: number;
  events: BattleEventV2[];
  rng: SeededRng;
  rules: BattleRules;
}): void {
  const skill = input.actor.ult;
  if (!skill) throw new Error("useUlt requires an ultimate skill");

  const allies = living(input.allies).sort(compareIds);
  const enemies = living(input.enemies).sort(compareIds);
  const friendly = input.actor.side === "ally" ? allies : enemies;
  const opposing = input.actor.side === "ally" ? enemies : allies;
  const action = actionForEffect(skill.effect);

  if (skill.effect === "damage_single") {
    const target = [...opposing].sort(compareLowestHpRatio)[0];
    if (!target) return;
    pushDamageEvent({
      ...input,
      action,
      target,
      skillId: skill.id,
      powerBps: skill.powerBps,
    });
    return;
  }

  if (skill.effect === "damage_aoe") {
    for (const target of opposing) {
      pushDamageEvent({
        ...input,
        action,
        target,
        skillId: skill.id,
        powerBps: skill.powerBps,
      });
    }
    return;
  }

  if (skill.effect === "heal_single") {
    const target = [...friendly].sort(compareLowestHpRatio)[0];
    if (!target) return;
    const amount = Math.max(
      1,
      Math.floor((input.actor.attack * skill.powerBps) / BPS),
    );
    target.currentHp = Math.min(target.maxHp, target.currentHp + amount);
    input.events.push({
      turn: input.turn,
      action,
      actorId: input.actor.id,
      targetId: target.id,
      skillId: skill.id,
      amount,
      critical: false,
      targetHp: target.currentHp,
      targetShield: target.shield,
      actorMp: input.actor.mp,
      targetMp: target.mp,
    });
    return;
  }

  if (skill.effect === "heal_aoe") {
    const amount = Math.max(
      1,
      Math.floor((input.actor.attack * skill.powerBps) / BPS),
    );
    for (const target of friendly) {
      target.currentHp = Math.min(target.maxHp, target.currentHp + amount);
      input.events.push({
        turn: input.turn,
        action,
        actorId: input.actor.id,
        targetId: target.id,
        skillId: skill.id,
        amount,
        critical: false,
        targetHp: target.currentHp,
        targetShield: target.shield,
        actorMp: input.actor.mp,
        targetMp: target.mp,
      });
    }
    return;
  }

  const amount = Math.max(
    1,
    Math.floor((input.actor.attack * skill.powerBps) / BPS),
  );
  for (const target of friendly) {
    target.shield += amount;
    input.events.push({
      turn: input.turn,
      action,
      actorId: input.actor.id,
      targetId: target.id,
      skillId: skill.id,
      amount,
      critical: false,
      targetHp: target.currentHp,
      targetShield: target.shield,
      actorMp: input.actor.mp,
      targetMp: target.mp,
    });
  }
}

export function simulateWaveV2(input: {
  allies: CombatantV2[];
  enemies: CombatantV2[];
  seed: number;
  rules?: Partial<BattleRules>;
  initialAllies?: BattleUnitStateV2[];
}): BattleResultV2 {
  if (input.allies.length === 0 || input.enemies.length === 0) {
    throw new Error("simulateWaveV2 requires at least one ally and one enemy");
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
  const allies = input.allies.map((unit) => toRuntime(unit, "ally"));
  const enemies = input.enemies.map((unit) => toRuntime(unit, "enemy"));
  if (input.initialAllies) {
    restoreInitialState(allies, input.initialAllies);
  }

  const events: BattleEventV2[] = [];
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

      actor.mp = Math.min(MP_MAX, actor.mp + MP_PER_TURN);
      turns += 1;

      if (actor.ult && actor.mp >= MP_MAX) {
        actor.mp = 0;
        useUlt({
          actor,
          allies,
          enemies,
          turn: turns,
          events,
          rng,
          rules,
        });
      } else {
        const target = targets[rng.nextInt(targets.length)]!;
        pushDamageEvent({
          actor,
          target,
          action: "basic_attack",
          skillId: null,
          powerBps: BPS,
          turn: turns,
          events,
          rng,
          rules,
        });
      }

      if (living(allies).length === 0 || living(enemies).length === 0) {
        break;
      }
    }
  }

  const alliesAlive = living(allies).length > 0;
  const enemiesAlive = living(enemies).length > 0;
  const result: BattleResultV2["result"] =
    alliesAlive && !enemiesAlive
      ? "win"
      : enemiesAlive && !alliesAlive
        ? "lose"
        : "draw";

  return {
    rulesVersion: "v2",
    result,
    turns,
    events,
    hash: hashBattleV2(result, turns, events),
    finalAllies: allies.map(snapshotUnit),
    finalEnemies: enemies.map(snapshotUnit),
  };
}
