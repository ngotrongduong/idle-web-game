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

export const GameDataSchema = z.object({
  version: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  items: z.array(ItemSchema).min(1),
  dungeons: z.array(DungeonSchema).min(1),
  classes: z.array(HeroClassSchema).min(1),
  enemies: z.array(EnemySchema).min(1),
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

  const materialIds = new Set(data.materials.map((entry) => entry.id));
  const dungeonIds = new Set(data.dungeons.map((entry) => entry.id));
  const classById = new Map(data.classes.map((entry) => [entry.id, entry]));

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

  return data;
}

export function validateMvpContentSlice(input: unknown): GameData {
  const data = validateGameData(input);

  if (data.materials.length < 15) throw new Error("MVP slice needs at least 15 materials");
  if (data.items.length < 30) throw new Error("MVP slice needs at least 30 items");
  if (data.dungeons.length !== 4) throw new Error("MVP slice needs exactly 4 dungeons");
  if (data.enemies.length !== 12) throw new Error("MVP slice needs exactly 12 enemies");
  if (data.classes.length !== 24) throw new Error("MVP slice needs exactly 24 classes");

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
  }

  return data;
}
