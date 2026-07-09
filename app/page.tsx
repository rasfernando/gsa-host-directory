import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SchoolCard } from "@/components/school-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getTranslations("home");
  const supabase = await createClient();
  const { data: featured } = await supabase
    .from("host_profiles")
    .select("id, name, slug, headline, country, city, tier, media, focus_tags, boarding, homestay, age_range_min, age_range_max, capacity")
    .eq("published", true)
    .order("tier", { ascending: false })
    .order("accredited_at", { ascending: true })
    .limit(6);

  return (
    <div>
      {/* Full-bleed hero — discovery-led: the main action is to look */}
      <section className="relative -mt-10 mb-16 ml-[calc(50%-50vw)] w-screen overflow-hidden bg-brand-900">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(110%_120%_at_82%_-10%,#c8612f_0%,transparent_52%)] opacity-60"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/80 to-transparent"
        />
        <WorldScene className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] w-full" />

        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-warm-200">
              {t("heroKicker")}
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-brand-100 sm:text-lg">
              {t("heroSubtitle")}
            </p>

            <Link
              href="/directory"
              className="mt-8 inline-block rounded-lg bg-warm-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-warm-700"
            >
              {t("browseAllHostSchools")}
            </Link>
          </div>
        </div>
      </section>

      {/* Featured immersions — the product, framed for sizing up the field.
          Always shown: real cards once schools are published, ~6 placeholder
          slots while the directory is still filling up. */}
      <section className="mt-16">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
              {t("featuredKicker")}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {t("featuredTitle")}
            </h2>
          </div>
          <Link
            href="/directory"
            className="hidden shrink-0 text-sm font-semibold text-warm-700 transition-colors duration-150 hover:text-warm-600 sm:inline-flex sm:items-center sm:gap-1"
          >
            {t("browseAll")} <span aria-hidden>→</span>
          </Link>
        </div>
        {featured && featured.length > 0 ? (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <li key={p.id}>
                <SchoolCard p={p} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <li
                key={idx}
                className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-6 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-100 text-warm-700">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" />
                  </svg>
                </span>
                <p className="mt-3 text-sm font-medium text-stone-500">
                  {t("featuredComingSoon")}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/directory"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-warm-700 sm:hidden"
        >
          {t("browseAllHostSchools")} <span aria-hidden>→</span>
        </Link>
      </section>

      {/* How it works */}
      <section className="mt-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-warm-700">
          {t("howItWorksKicker")}
        </p>
        <h2 className="mt-2 text-center text-2xl font-bold tracking-tight">
          {t("howItWorksTitle")}
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n={1} title={t("step1Title")}>
            {t("step1Body")}
          </Step>
          <Step n={2} title={t("step2Title")}>
            {t("step2Body")}
          </Step>
          <Step n={3} title={t("step3Title")}>
            {t("step3Body")}
          </Step>
        </ol>
      </section>

      {/* Trust — what the accredited badge means, for visiting schools */}
      <section className="mt-16 flex flex-col gap-4 rounded-2xl border border-stone-200/70 bg-white p-7 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckIcon className="h-3.5 w-3.5" />
            {t("accreditedBadge")}
          </span>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
            {t("accreditedBody")}
          </p>
        </div>
        <Link
          href="/accreditation"
          className="shrink-0 rounded-lg border border-stone-300 px-5 py-2.5 text-center text-sm font-semibold text-stone-700 transition-colors duration-150 hover:border-stone-400"
        >
          {t("accreditationLink")}
        </Link>
      </section>

      {/* Quiet host line — hosting is deliberately de-emphasised here */}
      <p className="mt-8 text-center text-sm text-stone-500">
        {t("hostPrompt")}{" "}
        <Link href="/list-your-school" className="font-semibold text-warm-700 underline">
          {t("listYourSchool")}
        </Link>
        .
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-100 text-sm font-bold text-warm-700">
        {n}
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{children}</p>
    </li>
  );
}

/*
 * Decorative "connected world" scene: a warm horizon with schools of
 * different cultures linked by connection arcs. Hand-built, warm-toned,
 * deliberately simple — placeholder until GSA supplies real photography.
 */
function WorldScene({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 380"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      aria-hidden
    >
      {/* soft sun */}
      <circle cx="1185" cy="150" r="58" fill="#e9a45c" opacity="0.55" />
      <circle cx="1185" cy="150" r="92" fill="#e9a45c" opacity="0.16" />

      {/* rolling hills */}
      <path d="M0 300 C 320 250 760 250 1080 280 S 1380 312 1440 300 L1440 380 L0 380 Z" fill="#b8502e" opacity="0.30" />
      <path d="M0 332 C 380 300 900 312 1440 330 L1440 380 L0 380 Z" fill="#983f25" opacity="0.55" />

      {/* connection arcs + pins */}
      <g stroke="#f3d9c0" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" opacity="0.7">
        <path d="M210 250 Q 360 180 510 244" />
        <path d="M510 244 Q 690 175 800 236" />
        <path d="M800 236 Q 940 180 1010 232" />
        <path d="M1010 232 Q 1140 188 1240 240" />
      </g>
      <g fill="#f0b878">
        <circle cx="210" cy="250" r="4" />
        <circle cx="510" cy="244" r="4" />
        <circle cx="800" cy="236" r="4" />
        <circle cx="1010" cy="232" r="4" />
        <circle cx="1240" cy="240" r="4" />
      </g>

      {/* schoolhouse with flag */}
      <g>
        <rect x="170" y="262" width="80" height="62" fill="#e89a64" />
        <path d="M165 262 L210 232 L255 262 Z" fill="#c25a34" />
        <rect x="196" y="290" width="28" height="34" fill="#fcd9b0" />
        <line x1="210" y1="232" x2="210" y2="210" stroke="#c25a34" strokeWidth="3" />
        <path d="M210 210 L232 216 L210 222 Z" fill="#e9a45c" />
      </g>

      {/* pagoda */}
      <g fill="#e89a64">
        <rect x="470" y="286" width="70" height="38" />
        <path d="M460 286 L505 264 L550 286 Z" fill="#c25a34" />
        <rect x="482" y="258" width="46" height="22" />
        <path d="M474 258 L505 242 L536 258 Z" fill="#c25a34" />
        <path d="M484 236 L505 224 L526 236 Z" fill="#c25a34" />
      </g>

      {/* domed building */}
      <g>
        <rect x="760" y="270" width="84" height="54" fill="#e89a64" />
        <path d="M760 270 A 42 42 0 0 1 844 270 Z" fill="#c25a34" />
        <line x1="802" y1="228" x2="802" y2="214" stroke="#e9a45c" strokeWidth="3" />
        <circle cx="802" cy="211" r="4" fill="#e9a45c" />
        <rect x="792" y="296" width="20" height="28" fill="#fcd9b0" />
      </g>

      {/* modern tower */}
      <g>
        <rect x="978" y="214" width="58" height="110" fill="#e89a64" />
        <g fill="#fcd9b0">
          <rect x="990" y="228" width="12" height="12" />
          <rect x="1012" y="228" width="12" height="12" />
          <rect x="990" y="252" width="12" height="12" />
          <rect x="1012" y="252" width="12" height="12" />
          <rect x="990" y="276" width="12" height="12" />
          <rect x="1012" y="276" width="12" height="12" />
        </g>
      </g>

      {/* classic columned building */}
      <g fill="#e89a64">
        <path d="M1196 266 L1284 266 L1240 244 Z" fill="#c25a34" />
        <rect x="1196" y="266" width="88" height="58" />
        <g fill="#c9663a">
          <rect x="1206" y="276" width="9" height="48" />
          <rect x="1226" y="276" width="9" height="48" />
          <rect x="1246" y="276" width="9" height="48" />
          <rect x="1266" y="276" width="9" height="48" />
        </g>
      </g>
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
