import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
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
              Global School Alliance
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
              Find a host school for your students
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-brand-100 sm:text-lg">
              Browse schools around the world ready to welcome visiting groups —
              by country, age range, and focus. Every one is reviewed by the GSA
              team, and accredited schools are verified for trip approval.
            </p>

            {/* Primary action: search the directory */}
            <form
              method="get"
              action="/directory"
              className="mt-8 flex max-w-md gap-2 rounded-xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur-sm"
            >
              <input
                name="country"
                placeholder="Search by country…"
                aria-label="Search host schools by country"
                className="min-w-0 flex-1 rounded-lg bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              <button className="shrink-0 rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                Search
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link
                href="/directory"
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                Browse all host schools →
              </Link>
              <Link
                href="/list-your-school"
                className="text-brand-200 transition-colors duration-150 hover:text-white"
              >
                Run a school? List as a host
              </Link>
            </div>

            <p className="mt-8 text-xs text-brand-200">
              Part of a network of 8,000+ schools across 142 countries.
            </p>
          </div>
        </div>
      </section>

      {/* Featured schools — the product, framed for sizing up the field */}
      {featured && featured.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
                Host schools
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                Schools welcoming visiting groups
              </h2>
            </div>
            <Link
              href="/directory"
              className="hidden shrink-0 text-sm font-semibold text-warm-700 transition-colors duration-150 hover:text-warm-600 sm:inline-flex sm:items-center sm:gap-1"
            >
              Browse all <span aria-hidden>→</span>
            </Link>
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-3">
            {featured.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/directory/${p.slug}`}
                  className="group block h-full overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md"
                >
                  {(p.media as { url: string }[] | null)?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(p.media as { url: string }[])[0].url}
                      alt={`${p.name} campus`}
                      className="aspect-[3/2] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/2] w-full items-center justify-center bg-gradient-to-br from-warm-50 to-warm-100">
                      <span className="text-4xl font-bold text-warm-300">
                        {p.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug group-hover:text-warm-700">
                        {p.name}
                      </h3>
                      {p.tier === "accredited" && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Accredited
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {p.city ? `${p.city}, ` : ""}
                      {p.country}
                      {p.age_range_min != null && ` · ages ${p.age_range_min}–${p.age_range_max}`}
                      {p.capacity != null && ` · up to ${p.capacity}`}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {p.boarding && <Tag>Boarding</Tag>}
                      {p.homestay && <Tag>Homestay</Tag>}
                      {((p.focus_tags as string[] | null) ?? []).slice(0, 2).map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/directory"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-warm-700 sm:hidden"
          >
            Browse all host schools <span aria-hidden>→</span>
          </Link>
        </section>
      )}

      {/* How it works */}
      <section className="mt-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-warm-700">
          How it works
        </p>
        <h2 className="mt-2 text-center text-2xl font-bold tracking-tight">
          Every visit is looked after by the GSA team
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          <Step n={1} title="Find a host school">
            Browse the directory of host schools worldwide — every listing is
            reviewed by the GSA team before it appears.
          </Step>
          <Step n={2} title="Send an enquiry">
            Tell us about your group and what you have in mind. No commitment —
            it starts a conversation, not a booking.
          </Step>
          <Step n={3} title="GSA makes it happen">
            The GSA team introduces you to the school and supports planning
            from there. You&apos;re never left to arrange things alone.
          </Step>
        </ol>
      </section>

      {/* Trust — what the accredited badge means, for visiting schools */}
      <section className="mt-16 flex flex-col gap-4 rounded-2xl border border-stone-200/70 bg-white p-7 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckIcon className="h-3.5 w-3.5" />
            GSA Accredited
          </span>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
            Look for the accredited badge. It means the GSA team has fully
            verified the school and issues a verification statement your
            leadership team can use for trip approval. Every other listing is a
            reviewed member of the network.
          </p>
        </div>
        <Link
          href="/accreditation"
          className="shrink-0 rounded-lg border border-stone-300 px-5 py-2.5 text-center text-sm font-semibold text-stone-700 transition-colors duration-150 hover:border-stone-400"
        >
          How accreditation works
        </Link>
      </section>

      {/* Quiet host line — hosting is deliberately de-emphasised here */}
      <p className="mt-8 text-center text-sm text-stone-500">
        Run a school and want to welcome visiting groups?{" "}
        <Link href="/list-your-school" className="font-semibold text-warm-700 underline">
          List your school
        </Link>
        .
      </p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
      {children}
    </span>
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
