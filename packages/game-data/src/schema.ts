import { z } from "zod";

const IdSchema = z.string().regex(/^[a-z0-9_]+$/, "must be a lowercase snake_case id");

export const ClassFamilySchema = z.enum([
  "vanguard",
  "ranger",
  "arcanist",
  "warden",
]);

export const ClassRoleSchema = z.enum([
  "tank",
  "physical_dps",
  "magic_dps",
  "support",
  "healer",
]);

export const MaterialSchema = z.object({
  id: IdSchema,
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
});

export const RecipeIngredientSchema = z.object({
  materialId: IdSchema,
  qty: z.number().int().positive(),
});

export const ItemSchema = z.object({
  id: IdSchema,
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  slot: z.enum(["weapon", "helmet", "armor", "accessory"]),
  attack: z.number().int().nonnegative(),
  defense: z.number().int().nonnegative(),
  recipe: z.array(RecipeIngredientSchema).min(1),
});

export const DungeonSchema = z.object({
  id: IdSchema,
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  recommendedLevel: z.number().int().positive(),
  waveCount: z.number().int().positive().max(20),
  lootMaterialIds: z.array(IdSchema).min(1),
});

export const HeroClassSchema = z.object({
  id: IdSchema,
  family: ClassFamilySchema,
  tier: z.number().int().min(1).max(3),
  parentClassId: IdSchema.nullable(),
  role: ClassRoleSchema,
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  baseHp: z.number().int().positive(),
  baseAttack: z.number().int().positive(),
  baseDefense: z.number().int().nonnegative(),
  baseSpeed: z.number().int().nonnegative(),
});

export const EnemySchema = z.object({
  id: IdSchema,
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  dungeonId: IdSchema,
  hp: z.number().int().positive(),
  attack: z.number().int().positive(),
  defense: z.number().int().nonnegative(),
  speed: z.number().int().nonnegative(),
});

export const SkillEffectSchema = z.enum([
  "damage_single",
  "damage_aoe",
  "heal_single",
  "heal_aoe",
  "shield_allies",
]);

export const SkillTargetSchema = z.enum([
  "lowest_hp_enemy",
  "all_enemies",
  "lowest_hp_ally",
  "all_allies",
]);

export const ClassSkillSchema = z.object({
  classId: IdSchema,
  ultId: IdSchema,
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  effect: SkillEffectSchema,
  target: SkillTargetSchema,
  powerBps: z.number().int().positive(),
  passiveStat: z.enum(["hp", "attack", "defense", "speed"]),
  passiveBonusBps: z.number().int().nonnegative(),
});

export const BossSchema = z.object({
  id: IdSchema,
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
  dungeonId: IdSchema,
  hp: z.number().int().positive(),
  attack: z.number().int().positive(),
  defense: z.number().int().nonnegative(),
  speed: z.number().int().nonnegative(),
});

export const DungeonWaveSchema = z.object({
  dungeonId: IdSchema,
  waveIndex: z.number().int().positive(),
  enemyIds: z.array(IdSchema),
  bossId: IdSchema.nullable(),
});

export const GameDataSchema = z.object({
  version: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  items: z.array(ItemSchema).min(1),
  dungeons: z.array(DungeonSchema).min(1),
  classes: z.array(HeroClassSchema).min(1),
  enemies: z.array(EnemySchema).min(1),
  skills: z.array(ClassSkillSchema).min(1),
  bosses: z.array(BossSchema).min(1),
  waves: z.array(DungeonWaveSchema).min(1),
});

export type GameData = z.infer<typeof GameDataSchema>;

function assertUniqueIds(label: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateGameData(input: unknown): GameData {
  const data = GameDataSchema.parse(input);

  assertUniqueIds("material", data.materials.map((entry) => entry.id));
  assertUniqueIds("item", data.items.map((entry) => entry.id));
  assertUniqueIds("dungeon", data.dungeons.map((entry) => entry.id));
  assertUniqueIds("class", data.classes.map((entry) => entry.id));
  assertUniqueIds("enemy", data.enemies.map((entry) => entry.id));
  assertUniqueIds("skill class", data.skills.map((entry) => entry.classId));
  assertUniqueIds("ult", data.skills.map((entry) => entry.ultId));
  assertUniqueIds("boss", data.bosses.map((entry) => entry.id));

  const materialIds = new Set(data.materials.map((entry) => entry.id));
  const dungeonIds = new Set(data.dungeons.map((entry) => entry.id));
  const classById = new Map(data.classes.map((entry) => [entry.id, entry]));
  const enemyById = new Map(data.enemies.map((entry) => [entry.id, entry]));
  const bossById = new Map(data.bosses.map((entry) => [entry.id, entry]));

  for (const item of data.items) {
    for (const ingredient of item.recipe) {
      if (!materialIds.has(ingredient.materialId)) {
        throw new Error(
          `Item ${item.id} references missing material ${ingredient.materialId}`,
        );
      }
    }
  }

  for (const dungeon of data.dungeons) {
    for (const materialId of dungeon.lootMaterialIds) {
      if (!materialIds.has(materialId)) {
        throw new Error(
          `Dungeon ${dungeon.id} references missing material ${materialId}`,
        );
      }
    }
  }

  for (const heroClass of data.classes) {
    if (heroClass.tier === 1) {
      if (heroClass.parentClassId !== null) {
        throw new Error(`Tier-1 class ${heroClass.id} must not have a parent`);
      }
      continue;
    }

    if (!heroClass.parentClassId) {
      throw new Error(`Class ${heroClass.id} is missing a parent class`);
    }

    const parent = classById.get(heroClass.parentClassId);
    if (!parent) {
      throw new Error(
        `Class ${heroClass.id} references missing parent ${heroClass.parentClassId}`,
      );
    }
    if (parent.family !== heroClass.family) {
      throw new Error(
        `Class ${heroClass.id} parent must stay in family ${heroClass.family}`,
      );
    }
    if (parent.tier !== heroClass.tier - 1) {
      throw new Error(
        `Class ${heroClass.id} parent must be tier ${heroClass.tier - 1}`,
      );
    }
  }

  for (const enemy of data.enemies) {
    if (!dungeonIds.has(enemy.dungeonId)) {
      throw new Error(
        `Enemy ${enemy.id} references missing dungeon ${enemy.dungeonId}`,
      );
    }
  }

  for (const skill of data.skills) {
    if (!classById.has(skill.classId)) {
      throw new Error(
        `Skill ${skill.ultId} references missing class ${skill.classId}`,
      );
    }
    const enemyEffect =
      skill.effect === "damage_single" || skill.effect === "damage_aoe";
    const enemyTarget =
      skill.target === "lowest_hp_enemy" || skill.target === "all_enemies";
    if (enemyEffect !== enemyTarget) {
      throw new Error(
        `Skill ${skill.ultId} effect/target sides do not match`,
      );
    }
  }

  for (const boss of data.bosses) {
    if (!dungeonIds.has(boss.dungeonId)) {
      throw new Error(
        `Boss ${boss.id} references missing dungeon ${boss.dungeonId}`,
      );
    }
  }

  for (const wave of data.waves) {
    if (!dungeonIds.has(wave.dungeonId)) {
      throw new Error(
        `Wave references missing dungeon ${wave.dungeonId}`,
      );
    }

    const hasEnemies = wave.enemyIds.length > 0;
    const hasBoss = wave.bossId !== null;
    if (hasEnemies === hasBoss) {
      throw new Error(
        `Wave ${wave.dungeonId}#${wave.waveIndex} must contain enemies or one boss, not both`,
      );
    }

    for (const enemyId of wave.enemyIds) {
      const enemy = enemyById.get(enemyId);
      if (!enemy) {
        throw new Error(
          `Wave ${wave.dungeonId}#${wave.waveIndex} references missing enemy ${enemyId}`,
        );
      }
      if (enemy.dungeonId !== wave.dungeonId) {
        throw new Error(
          `Wave ${wave.dungeonId}#${wave.waveIndex} uses enemy ${enemyId} from another dungeon`,
        );
      }
    }

    if (wave.bossId) {
      const boss = bossById.get(wave.bossId);
      if (!boss) {
        throw new Error(
          `Wave ${wave.dungeonId}#${wave.waveIndex} references missing boss ${wave.bossId}`,
        );
      }
      if (boss.dungeonId !== wave.dungeonId) {
        throw new Error(
          `Wave ${wave.dungeonId}#${wave.waveIndex} uses boss ${wave.bossId} from another dungeon`,
        );
      }
    }
  }

  return data;
}

export function validateMvpContentSlice(input: unknown): GameData {
  const data = validateGameData(input);

  if (data.materials.length < 15) throw new Error("MVP slice needs at least 15 materials");
  if (data.items.length < 30) throw new Error("MVP slice needs at least 30 items");
  if (data.dungeons.length !== 4) throw new Error("MVP slice needs exactly 4 dungeons");
  if (data.enemies.length !== 12) throw new Error("MVP slice needs exactly 12 enemies");
  if (data.classes.length !== 24) throw new Error("MVP slice needs exactly 24 classes");
  if (data.skills.length !== 24) throw new Error("MVP slice needs exactly 24 class skills");
  if (data.bosses.length !== 4) throw new Error("MVP slice needs exactly 4 bosses");
  if (data.waves.length !== 24) throw new Error("MVP slice needs exactly 24 dungeon waves");

  for (const family of ClassFamilySchema.options) {
    const familyClasses = data.classes.filter((entry) => entry.family === family);
    const tierCounts = [1, 2, 3].map(
      (tier) => familyClasses.filter((entry) => entry.tier === tier).length,
    );
    if (tierCounts[0] !== 1 || tierCounts[1] !== 2 || tierCounts[2] !== 3) {
      throw new Error(
        `Family ${family} must contain 1 T1, 2 T2 and 3 T3 classes`,
      );
    }
  }

  for (const dungeon of data.dungeons) {
    const enemyCount = data.enemies.filter(
      (enemy) => enemy.dungeonId === dungeon.id,
    ).length;
    if (enemyCount !== 3) {
      throw new Error(
        `Dungeon ${dungeon.id} must contain exactly 3 enemy families in the MVP slice`,
      );
    }

    const bosses = data.bosses.filter((boss) => boss.dungeonId === dungeon.id);
    if (bosses.length !== 1) {
      throw new Error(
        `Dungeon ${dungeon.id} must contain exactly one boss`,
      );
    }

    const waves = data.waves
      .filter((wave) => wave.dungeonId === dungeon.id)
      .sort((left, right) => left.waveIndex - right.waveIndex);

    if (waves.length !== dungeon.waveCount) {
      throw new Error(
        `Dungeon ${dungeon.id} must contain ${dungeon.waveCount} waves`,
      );
    }

    for (let index = 0; index < waves.length; index += 1) {
      if (waves[index]!.waveIndex !== index + 1) {
        throw new Error(
          `Dungeon ${dungeon.id} wave indexes must be contiguous from 1`,
        );
      }
    }

    if (waves.at(-1)?.bossId !== bosses[0]!.id) {
      throw new Error(
        `Dungeon ${dungeon.id} final wave must use boss ${bosses[0]!.id}`,
      );
    }
    if (waves.slice(0, -1).some((wave) => wave.bossId !== null)) {
      throw new Error(
        `Dungeon ${dungeon.id} may only place its boss on the final wave`,
      );
    }
  }

  return data;
}
