import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: featured } = await supabase
    .from("host_profiles")
    .select("id, name, slug, headline, country, city, tier, media")
    .eq("published", true)
    .order("tier", { ascending: false })
    .order("accredited_at", { ascending: true })
    .limit(3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-16 sm:px-12 sm:py-20">
        {/* layered background: radial glow + connection-arc globe */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(80%_90%_at_85%_10%,#24509e_0%,transparent_60%)]"
        />
        <GlobeArt className="absolute -right-24 -top-24 h-[34rem] w-[34rem] text-brand-200 opacity-[0.18] sm:-right-12 sm:-top-16" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">
            Global School Alliance
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Welcome the world to your school
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-100 sm:text-lg">
            Host visiting school groups from around the world — build global
            citizenship at your school and get paid for hosting. Or find a
            GSA-verified school for your next trip abroad.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/list-your-school"
              className="rounded-lg bg-white px-6 py-3 text-center text-sm font-semibold text-brand-800 transition-colors duration-150 hover:bg-brand-50"
            >
              List your school
            </Link>
            <Link
              href="/directory"
              className="rounded-lg border border-brand-600 px-6 py-3 text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-700"
            >
              Browse the directory
            </Link>
          </div>
          <p className="mt-8 text-xs text-brand-200">
            Part of the Global School Alliance — a network of 8,000+ schools
            across 142 countries.
          </p>
        </div>
      </section>

      {/* Featured host schools — real listings, real photos */}
      {featured && featured.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                From the directory
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                Host schools ready to welcome you
              </h2>
            </div>
            <Link
              href="/directory"
              className="hidden shrink-0 text-sm font-semibold text-brand-700 transition-colors duration-150 hover:text-brand-800 sm:inline-flex sm:items-center sm:gap-1"
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
                    <div className="flex aspect-[3/2] w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                      <span className="text-4xl font-bold text-brand-200">
                        {p.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug group-hover:text-brand-800">
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
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/directory"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 sm:hidden"
          >
            Browse all host schools <span aria-hidden>→</span>
          </Link>
        </section>
      )}

      {/* How it works */}
      <section className="mt-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-stone-500">
          How it works
        </p>
        <h2 className="mt-2 text-center text-2xl font-bold tracking-tight">
          Every visit is facilitated by the GSA team
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

      {/* Two audiences */}
      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-stone-200/70 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            For visiting schools
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight">
            Plan a trip your leadership team can sign off
          </h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">
            Find verified host schools by country, age range, and focus area.
            GSA Accredited schools come with a printable verification statement
            — what we checked and when — ready for your head, governors, or
            EVC.
          </p>
          <Link
            href="/directory"
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition-colors duration-150 hover:text-brand-800"
          >
            Browse host schools <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="flex flex-col rounded-2xl border border-stone-200/70 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            For host schools
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight">
            Open your doors to the world
          </h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">
            Join the directory in a few minutes. Welcome overseas groups, give
            your students a global experience without leaving campus, and get
            paid for hosting.
          </p>
          <Link
            href="/list-your-school"
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition-colors duration-150 hover:text-brand-800"
          >
            List your school <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Accreditation strip */}
      <section className="mt-16 flex flex-col gap-4 rounded-2xl border border-stone-200/70 bg-white p-7 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckIcon className="h-3.5 w-3.5" />
            GSA Accredited
          </span>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
            Already listed? Accreditation is the gold standard — full
            verification by the GSA team, active promotion to visiting groups
            worldwide, and a verification statement schools can use for trip
            approval.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href="/apply"
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-800"
          >
            Apply for accreditation
          </Link>
          <Link
            href="/accreditation"
            className="text-center text-xs text-stone-500 underline transition-colors duration-150 hover:text-stone-900"
          >
            How accreditation works
          </Link>
        </div>
      </section>
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
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
        {n}
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{children}</p>
    </li>
  );
}

/* Abstract globe with connection arcs — decorative only */
function GlobeArt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden
    >
      <circle cx="200" cy="200" r="160" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="200" cy="200" rx="160" ry="62" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="200" cy="200" rx="160" ry="118" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <ellipse cx="200" cy="200" rx="62" ry="160" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="200" cy="200" rx="118" ry="160" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="40" y1="200" x2="360" y2="200" stroke="currentColor" strokeWidth="1.5" />
      {/* connection arcs */}
      <path d="M105 130 Q 200 30 295 118" stroke="currentColor" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
      <path d="M88 262 Q 210 330 312 244" stroke="currentColor" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
      {/* nodes */}
      <circle cx="105" cy="130" r="6" fill="currentColor" />
      <circle cx="295" cy="118" r="6" fill="currentColor" />
      <circle cx="88" cy="262" r="6" fill="currentColor" />
      <circle cx="312" cy="244" r="6" fill="currentColor" />
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
