import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FOCUS_AREAS = [
  "Sustainability",
  "STEM",
  "Inclusion & SEND",
  "Cultural programmes",
  "Digital & AI",
  "Active citizenship",
];

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("host_profiles")
    .select(
      "id, name, slug, headline, country, city, languages, age_range_min, age_range_max, focus_tags, boarding, homestay, capacity, tier, media"
    )
    .eq("published", true)
    // Accredited schools first — they're the actively promoted catalog
    .order("tier", { ascending: false })
    .order("name");

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.country) query = query.ilike("country", `%${params.country}%`);
  if (params.focus) query = query.contains("focus_tags", [params.focus]);
  if (params.boarding === "on") query = query.eq("boarding", true);
  if (params.homestay === "on") query = query.eq("homestay", true);
  if (params.accredited === "on") query = query.eq("tier", "accredited");

  const { data: profiles } = await query;
  const results = profiles ?? [];
  const hasFilters =
    params.q || params.country || params.focus || params.boarding || params.homestay || params.accredited;

  const inputCls =
    "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
        Directory
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Host schools worldwide
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
        <span className="font-semibold text-emerald-700">GSA Accredited</span>{" "}
        schools have passed GSA&apos;s gold-standard verification and are
        actively promoted. Listed hosts are reviewed members of the network.{" "}
        <Link href="/accreditation" className="underline transition-colors duration-150 hover:text-stone-900">
          How accreditation works
        </Link>
      </p>

      {/* Filters — a plain GET form, no JavaScript needed */}
      <form
        method="get"
        className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm"
      >
        <input name="q" defaultValue={params.q} placeholder="Search schools…" className={inputCls} />
        <input name="country" defaultValue={params.country} placeholder="Country" className={`${inputCls} w-36`} />
        <select name="focus" defaultValue={params.focus ?? ""} className={inputCls}>
          <option value="">Any focus</option>
          {FOCUS_AREAS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" name="boarding" defaultChecked={params.boarding === "on"} className="rounded border-stone-300" />
          Boarding
        </label>
        <label className="flex items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" name="homestay" defaultChecked={params.homestay === "on"} className="rounded border-stone-300" />
          Homestay
        </label>
        <label className="flex items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" name="accredited" defaultChecked={params.accredited === "on"} className="rounded border-stone-300" />
          GSA Accredited only
        </label>
        <button className="rounded-lg bg-warm-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
          Show matching schools
        </button>
        {hasFilters && (
          <Link href="/directory" className="text-sm text-stone-500 underline">
            Clear
          </Link>
        )}
      </form>

      {results.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <h2 className="text-base font-semibold">No matching schools yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
            The network is growing every week. Try widening your filters, or
            check back soon.
          </p>
          {hasFilters && (
            <Link
              href="/directory"
              className="mt-5 inline-block rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors duration-150 hover:border-stone-400"
            >
              Clear all filters
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {results.map((p) => (
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
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                    <span className="text-5xl font-bold text-brand-200">
                      {p.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-snug group-hover:text-brand-800">
                      {p.name}
                    </h2>
                    {p.tier === "accredited" ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                        GSA Accredited
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-500">
                        Listed host
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {p.city ? `${p.city}, ` : ""}{p.country}
                    {p.age_range_min != null && ` · ages ${p.age_range_min}–${p.age_range_max}`}
                    {p.capacity != null && ` · groups up to ${p.capacity}`}
                  </p>
                  {p.headline && (
                    <p className="mt-2.5 text-sm leading-relaxed text-stone-600">
                      {p.headline}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.boarding && <Tag>Boarding</Tag>}
                    {p.homestay && <Tag>Homestay</Tag>}
                    {(p.focus_tags ?? []).slice(0, 3).map((t: string) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
      {children}
    </span>
  );
}
