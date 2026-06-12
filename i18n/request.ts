import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Cookie-based locale (no URL prefixes): the whole tree — including deep
// pages like directory → school → pay — renders in the chosen language.
export const LOCALES = ["en", "zh", "fr", "es", "de", "pl"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "NEXT_LOCALE";

export default getRequestConfig(async () => {
  const store = await cookies();
  const candidate = store.get(LOCALE_COOKIE)?.value;
  const locale = (LOCALES as readonly string[]).includes(candidate ?? "")
    ? (candidate as Locale)
    : "en";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
