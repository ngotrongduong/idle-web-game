import { validateGameData, type GameData } from "./schema";

export type CsvSources = {
  materials: string;
  items: string;
  dungeons: string;
};

export function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === ",") {
      pushCell();
      continue;
    }

    if (!quoted && char === "\n") {
      pushRow();
      continue;
    }

    if (!quoted && char === "\r") continue;
    cell += char;
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  if (cell.length > 0 || row.length > 0) pushRow();
  if (rows.length === 0) return [];

  const headers = rows[0]!.map((header) => header.trim());
  if (headers.some((header) => header.length === 0)) {
    throw new Error("CSV contains an empty header");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV contains duplicate headers");
  }

  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${values.length} cells; expected ${headers.length}`,
      );
    }

    return Object.fromEntries(
      headers.map((header, index) => [header, values[index]!.trim()]),
    );
  });
}

function requireValue(
  row: Record<string, string>,
  key: string,
  context: string,
): string {
  const value = row[key];
  if (!value) throw new Error(`${context}: missing ${key}`);
  return value;
}

function parseIntField(
  row: Record<string, string>,
  key: string,
  context: string,
): number {
  const raw = requireValue(row, key, context);
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${context}: ${key} must be an integer, got ${raw}`);
  }
  return value;
}

function parseList(raw: string): string[] {
  return raw
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseRecipe(raw: string, context: string) {
  return parseList(raw).map((part) => {
    const [materialId, qtyRaw, extra] = part.split(":");
    if (!materialId || !qtyRaw || extra !== undefined) {
      throw new Error(`${context}: invalid recipe ingredient ${part}`);
    }
    const qty = Number(qtyRaw);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error(`${context}: invalid recipe quantity ${qtyRaw}`);
    }
    return { materialId, qty };
  });
}

export function loadGameDataFromCsv(
  sources: CsvSources,
  version = "m0.3",
): GameData {
  const materials = parseCsv(sources.materials).map((row, index) => ({
    id: requireValue(row, "id", `materials row ${index + 2}`),
    nameVi: requireValue(row, "name_vi", `materials row ${index + 2}`),
    nameEn: requireValue(row, "name_en", `materials row ${index + 2}`),
  }));

  const items = parseCsv(sources.items).map((row, index) => {
    const context = `items row ${index + 2}`;
    return {
      id: requireValue(row, "id", context),
      nameVi: requireValue(row, "name_vi", context),
      nameEn: requireValue(row, "name_en", context),
      slot: requireValue(row, "slot", context),
      attack: parseIntField(row, "attack", context),
      defense: parseIntField(row, "defense", context),
      recipe: parseRecipe(requireValue(row, "recipe", context), context),
    };
  });

  const dungeons = parseCsv(sources.dungeons).map((row, index) => {
    const context = `dungeons row ${index + 2}`;
    return {
      id: requireValue(row, "id", context),
      nameVi: requireValue(row, "name_vi", context),
      nameEn: requireValue(row, "name_en", context),
      recommendedLevel: parseIntField(row, "recommended_level", context),
      waveCount: parseIntField(row, "wave_count", context),
      lootMaterialIds: parseList(
        requireValue(row, "loot_material_ids", context),
      ),
    };
  });

  return validateGameData({ version, materials, items, dungeons });
}
