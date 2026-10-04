import { z } from "zod";

const IdSchema = z.string().regex(/^[a-z0-9_]+$/, "must be a lowercase snake_case id");
const LocalizedNameSchema = z.object({
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
});

export const MaterialSchema = z.object({ id: IdSchema }).and(LocalizedNameSchema);

export const RecipeIngredientSchema = z.object({
  materialId: IdSchema,
  qty: z.number().int().positive(),
});

export const ItemSchema = z
  .object({
    id: IdSchema,
    slot: z.enum(["weapon", "helmet", "armor", "accessory"]),
    attack: z.number().int().nonnegative(),
    defense: z.number().int().nonnegative(),
    recipe: z.array(RecipeIngredientSchema).min(1),
  })
  .and(LocalizedNameSchema);

export const DungeonSchema = z
  .object({
    id: IdSchema,
    recommendedLevel: z.number().int().positive(),
    waveCount: z.number().int().positive().max(20),
    lootMaterialIds: z.array(IdSchema).min(1),
  })
  .and(LocalizedNameSchema);

export const ClassFamilySchema = z
  .object({
    id: IdSchema,
    archetype: z.enum(["frontline", "ranged", "caster", "support"]),
    damageType: z.enum(["physical", "magical"]),
    advantageFamilyId: IdSchema,
  })
  .and(LocalizedNameSchema);

export const HeroClassSchema = z
  .object({
    id: IdSchema,
    familyId: IdSchema,
    tier: z.number().int().min(1).max(3),
    parentClassId: IdSchema.nullable(),
    role: z.enum(["tank", "damage", "support", "hybrid"]),
    baseHp: z.number().int().positive(),
    baseAttack: z.number().int().positive(),
    baseDefense: z.number().int().nonnegative(),
    baseSpeed: z.number().int().nonnegative(),
    targeting: z.enum(["random", "lowest_hp", "highest_attack"]),
    ultimateKind: z.enum(["damage", "heal"]),
    ultimateTargeting: z.enum(["random", "lowest_hp", "highest_attack"]),
    ultimatePowerBps: z.number().int().positive(),
  })
  .and(LocalizedNameSchema);

export const EnemySchema = z
  .object({
    id: IdSchema,
    dungeonId: IdSchema,
    rank: z.enum(["normal", "elite", "boss"]),
    hp: z.number().int().positive(),
    attack: z.number().int().positive(),
    defense: z.number().int().nonnegative(),
    speed: z.number().int().nonnegative(),
    rewardGold: z.number().int().nonnegative(),
    rewardExp: z.number().int().nonnegative(),
  })
  .and(LocalizedNameSchema);

export const GameDataSchema = z.object({
  version: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  items: z.array(ItemSchema).min(1),
  dungeons: z.array(DungeonSchema).min(1),
  classFamilies: z.array(ClassFamilySchema).min(1),
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

  assertUniqueIds(
    "material",
    data.materials.map((entry) => entry.id),
  );
  assertUniqueIds(
    "item",
    data.items.map((entry) => entry.id),
  );
  assertUniqueIds(
    "dungeon",
    data.dungeons.map((entry) => entry.id),
  );
  assertUniqueIds(
    "class family",
    data.classFamilies.map((entry) => entry.id),
  );
  assertUniqueIds(
    "class",
    data.classes.map((entry) => entry.id),
  );
  assertUniqueIds(
    "enemy",
    data.enemies.map((entry) => entry.id),
  );

  const materialIds = new Set(data.materials.map((entry) => entry.id));
  const dungeonIds = new Set(data.dungeons.map((entry) => entry.id));
  const familyIds = new Set(data.classFamilies.map((entry) => entry.id));
  const classById = new Map(data.classes.map((entry) => [entry.id, entry]));

  for (const item of data.items) {
    for (const ingredient of item.recipe) {
      if (!materialIds.has(ingredient.materialId)) {
        throw new Error(`Item ${item.id} references missing material ${ingredient.materialId}`);
      }
    }
  }

  for (const dungeon of data.dungeons) {
    for (const materialId of dungeon.lootMaterialIds) {
      if (!materialIds.has(materialId)) {
        throw new Error(`Dungeon ${dungeon.id} references missing material ${materialId}`);
      }
    }
  }

  for (const family of data.classFamilies) {
    if (!familyIds.has(family.advantageFamilyId)) {
      throw new Error(
        `Class family ${family.id} references missing advantage family ${family.advantageFamilyId}`,
      );
    }
    if (family.advantageFamilyId === family.id) {
      throw new Error(`Class family ${family.id} cannot counter itself`);
    }
  }

  for (const heroClass of data.classes) {
    if (!familyIds.has(heroClass.familyId)) {
      throw new Error(`Class ${heroClass.id} references missing family ${heroClass.familyId}`);
    }

    if (heroClass.tier === 1) {
      if (heroClass.parentClassId !== null) {
        throw new Error(`Tier 1 class ${heroClass.id} must not have a parent`);
      }
      continue;
    }

    if (heroClass.parentClassId === null) {
      throw new Error(`Tier ${heroClass.tier} class ${heroClass.id} must have a parent`);
    }

    const parent = classById.get(heroClass.parentClassId);
    if (!parent) {
      throw new Error(`Class ${heroClass.id} references missing parent ${heroClass.parentClassId}`);
    }
    if (parent.familyId !== heroClass.familyId) {
      throw new Error(`Class ${heroClass.id} parent must belong to the same family`);
    }
    if (parent.tier !== heroClass.tier - 1) {
      throw new Error(`Class ${heroClass.id} parent must be tier ${heroClass.tier - 1}`);
    }
  }

  for (const enemy of data.enemies) {
    if (!dungeonIds.has(enemy.dungeonId)) {
      throw new Error(`Enemy ${enemy.id} references missing dungeon ${enemy.dungeonId}`);
    }
  }

  return data;
}
