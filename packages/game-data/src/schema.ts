import { z } from "zod";

const IdSchema = z.string().regex(/^[a-z0-9_]+$/, "must be a lowercase snake_case id");
const LocalizedNameSchema = z.object({
  nameVi: z.string().min(1),
  nameEn: z.string().min(1),
});

export const MaterialSchema = z
  .object({
    id: IdSchema,
  })
  .and(LocalizedNameSchema);

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

export const GameDataSchema = z.object({
  version: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  items: z.array(ItemSchema).min(1),
  dungeons: z.array(DungeonSchema).min(1),
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

  const materialIds = new Set(data.materials.map((entry) => entry.id));

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

  return data;
}
