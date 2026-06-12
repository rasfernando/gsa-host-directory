import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { localized } from "@/lib/i18n-content";

type MediaItem = { url: string };

export type SchoolCardData = {
  id: string;
  name: string;
  slug: string;
  headline?: string | null;
  country: string;
  city?: string | null;
  tier: string;
  media?: unknown;
  focus_tags?: string[] | null;
  boarding?: boolean | null;
  homestay?: boolean | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
  capacity?: number | null;
  translations?: unknown;
};

export async function SchoolCard({ p }: { p: SchoolCardData }) {
  const locale = await getLocale();
  const t = await getTranslations("card");
  const tv = await getTranslations("vocab");
  // Enumerable values translate via the vocab dictionary, falling back to
  // the raw English value when a term (or the locale) has no entry.
  const v = (s: string) => (tv.has(s) ? tv(s) : s);

  const cover = (p.media as MediaItem[] | null)?.[0]?.url ?? null;
  const accredited = p.tier === "accredited";
  const focus = (p.focus_tags ?? []).slice(0, 2);
  const headline = localized(p as Record<string, unknown>, "headline", locale);

  return (
    <Link
      href={`/directory/${p.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg"
    >
      {/* Image with overlaid status seal */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${p.name} campus`}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-warm-100 via-warm-50 to-brand-50">
            <span className="text-5xl font-bold text-warm-300">
              {p.name.charAt(0)}
            </span>
          </div>
        )}

        {/* scrim so the seal stays legible over bright photos */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent"
        />

        {accredited ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 py-1 pl-1.5 pr-2.5 text-[11px] font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-600/10 backdrop-blur">
            <SealIcon className="h-4 w-4 text-emerald-600" />
            {t("accredited")}
          </span>
        ) : p.tier === "verified" ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 py-1 pl-1.5 pr-2.5 text-[11px] font-semibold text-brand-800 shadow-sm ring-1 ring-brand-600/10 backdrop-blur">
            <SealIcon className="h-4 w-4 text-brand-600" />
            {t("verified")}
          </span>
        ) : (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-stone-900/55 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            {t("listed")}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-stone-900 group-hover:text-warm-700">
          {p.name}
        </h3>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500">
          <PinIcon className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          {localized(p as Record<string, unknown>, "city", locale)
            ? `${localized(p as Record<string, unknown>, "city", locale)}, `
            : ""}
          {v(p.country)}
        </p>

        {headline && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-600">
            {headline}
          </p>
        )}

        {/* spec chips */}
        {(p.age_range_min != null || p.capacity != null) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-600">
            {p.age_range_min != null && (
              <span className="inline-flex items-center gap-1.5">
                <CapIcon className="h-3.5 w-3.5 text-warm-600" />
                {t("ages", { min: p.age_range_min, max: p.age_range_max ?? "" })}
              </span>
            )}
            {p.capacity != null && (
              <span className="inline-flex items-center gap-1.5">
                <UsersIcon className="h-3.5 w-3.5 text-warm-600" />
                {t("upTo", { capacity: p.capacity })}
              </span>
            )}
          </div>
        )}

        {/* tags pinned to the bottom */}
        <div className="mt-3 flex flex-wrap gap-1.5 pt-1">
          {p.boarding && <Chip tone="stone">{t("boarding")}</Chip>}
          {p.homestay && <Chip tone="stone">{t("homestay")}</Chip>}
          {focus.map((tag) => (
            <Chip key={tag} tone="warm">
              {v(tag)}
            </Chip>
          ))}
        </div>
      </div>
    </Link>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warm" | "stone";
}) {
  return (
    <span
      className={
        tone === "warm"
          ? "rounded-full bg-warm-50 px-2 py-0.5 text-[11px] font-medium text-warm-700"
          : "rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
      }
    >
      {children}
    </span>
  );
}

/* — icons — */
function SealIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1.5l2.4 1.74 2.96-.02 .9 2.82 2.4 1.76-.92 2.82.92 2.82-2.4 1.76-.9 2.82-2.96-.02L12 22.5l-2.4-1.74-2.96.02-.9-2.82-2.4-1.76.92-2.82L3.34 8.6l2.4-1.76.9-2.82 2.96.02L12 1.5z" />
      <path
        d="M8.6 12.2l2.2 2.2 4.4-4.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  );
}

function CapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </svg>
  );
}
