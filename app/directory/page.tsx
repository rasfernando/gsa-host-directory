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

  const inputCls =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Host schools worldwide
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        <span className="font-medium text-green-700">GSA Accredited</span>{" "}
        schools have passed GSA&apos;s gold-standard verification and are
        actively promoted. Listed hosts are reviewed members of the network.
      </p>

      {/* Filters — a plain GET form, no JavaScript needed */}
      <form method="get" className="mt-6 flex flex-wrap items-center gap-3">
        <input name="q" defaultValue={params.q} placeholder="Search schools…" className={inputCls} />
        <input name="country" defaultValue={params.country} placeholder="Country" className={`${inputCls} w-36`} />
        <select name="focus" defaultValue={params.focus ?? ""} className={inputCls}>
          <option value="">Any focus</option>
          {FOCUS_AREAS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" name="boarding" defaultChecked={params.boarding === "on"} className="rounded border-gray-300" />
          Boarding
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" name="homestay" defaultChecked={params.homestay === "on"} className="rounded border-gray-300" />
          Homestay
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" name="accredited" defaultChecked={params.accredited === "on"} className="rounded border-gray-300" />
          GSA Accredited only
        </label>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
          Filter
        </button>
        {(params.q || params.country || params.focus || params.boarding || params.homestay) && (
          <Link href="/directory" className="text-sm text-gray-500 underline">
            Clear
          </Link>
        )}
      </form>

      {results.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          No host schools match these filters yet. The network is growing —
          check back soon.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {results.map((p) => (
            <li key={p.id}>
              <Link
                href={`/directory/${p.slug}`}
                className="block overflow-hidden rounded-xl border border-gray-100 transition hover:border-gray-300"
              >
                {(p.media as { url: string }[] | null)?.[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(p.media as { url: string }[])[0].url}
                    alt={`${p.name} campus`}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                    <span className="text-4xl font-semibold text-gray-300">
                      {p.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="p-5">
                <div className="flex items-start justify-between">
                  <h2 className="text-base font-semibold">{p.name}</h2>
                  {p.tier === "accredited" ? (
                    <span className="ml-3 shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                      GSA Accredited
                    </span>
                  ) : (
                    <span className="ml-3 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      Listed host
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  {p.city ? `${p.city}, ` : ""}{p.country}
                  {p.age_range_min != null && ` · ages ${p.age_range_min}–${p.age_range_max}`}
                  {p.capacity != null && ` · groups up to ${p.capacity}`}
                </p>
                {p.headline && <p className="mt-2 text-sm text-gray-600">{p.headline}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
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
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
      {children}
    </span>
  );
}
