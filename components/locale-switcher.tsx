import { setLocale } from "@/app/actions";
import { LOCALES, type Locale } from "@/i18n/request";

// Flag + native name per locale; shown in their own language so anyone can
// find theirs regardless of the current site language.
const LOCALE_META: Record<Locale, { flag: string; name: string }> = {
  en: { flag: "🇬🇧", name: "English" },
  zh: { flag: "🇨🇳", name: "中文" },
  fr: { flag: "🇫🇷", name: "Français" },
  es: { flag: "🇪🇸", name: "Español" },
  de: { flag: "🇩🇪", name: "Deutsch" },
  pl: { flag: "🇵🇱", name: "Polski" },
};

// No-JS dropdown: <details> popover + a server-action form. Picking a
// language submits and reloads, which also closes the menu.
export function LocaleSwitcher({ locale }: { locale: string }) {
  const current = LOCALE_META[locale as Locale] ?? LOCALE_META.en;
  return (
    <details className="relative">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors duration-150 hover:border-stone-300 hover:text-stone-900 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-sm leading-none">{current.flag}</span>
        <span className="uppercase">{locale}</span>
        <svg
          className="h-3 w-3 text-stone-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <form
        action={setLocale}
        className="absolute right-0 top-full z-50 mt-1.5 w-40 overflow-hidden rounded-xl border border-stone-200/70 bg-white py-1 shadow-lg"
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            name="locale"
            value={l}
            className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-100 hover:bg-stone-50 ${
              l === locale ? "font-semibold text-stone-900" : "text-stone-600"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              {LOCALE_META[l].flag}
            </span>
            {LOCALE_META[l].name}
            {l === locale && (
              <span className="ml-auto text-warm-600" aria-hidden>
                ✓
              </span>
            )}
          </button>
        ))}
      </form>
    </details>
  );
}
