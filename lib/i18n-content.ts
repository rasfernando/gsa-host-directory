// DB-content translation convention: rows carry a `translations` jsonb of
// shape {"pl": {"headline": "...", "description": "..."}}. Render with this
// helper and untranslated fields fall back to the English source column.
export function localized<T extends Record<string, unknown>>(
  row: T,
  field: string,
  locale: string
): string | null {
  const translations = row["translations"] as
    | Record<string, Record<string, string>>
    | null
    | undefined;
  const translated = translations?.[locale]?.[field];
  const source = row[field];
  return translated || (typeof source === "string" ? source : null);
}
