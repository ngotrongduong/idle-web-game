import { type Locale } from "@idle/i18n";

/** Anything the catalog names in both languages. */
export type NamedEntry = {
  id: string;
  nameVi: string;
  nameEn: string;
};

/** The entry's name in the player's language. */
export function localizedName(
  entry: Pick<NamedEntry, "nameVi" | "nameEn">,
  locale: Locale,
): string {
  return locale === "vi" ? entry.nameVi : entry.nameEn;
}

/**
 * The catalog name of `id`, or undefined while the catalog is missing or does not know the id.
 * The caller shows a neutral placeholder then: the legacy id itself must never reach the screen.
 */
export function findCatalogName(
  entries: readonly NamedEntry[] | undefined,
  id: string,
  locale: Locale,
): string | undefined {
  const entry = entries?.find((candidate) => candidate.id === id);
  return entry ? localizedName(entry, locale) : undefined;
}
