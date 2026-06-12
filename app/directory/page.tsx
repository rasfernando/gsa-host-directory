import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SchoolCard } from "@/components/school-card";
import { DirectoryMap, type MapSchool } from "@/components/directory-map";

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
  const t = await getTranslations("directory");
  const supabase = await createClient();

  let query = supabase
    .from("host_profiles")
    .select(
      "id, name, slug, headline, country, city, languages, age_range_min, age_range_max, focus_tags, boarding, homestay, capacity, tier, media, lat, lng"
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

  // Map view: needs the Mapbox token and at least one geocoded school.
  const mapEnabled = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const mapSchools: MapSchool[] = results
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      city: p.city,
      country: p.country,
      tier: p.tier,
      lat: p.lat as number,
      lng: p.lng as number,
    }));
  const showMap = params.view === "map" && mapEnabled && mapSchools.length > 0;
  const filterQuery = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => v && k !== "view") as [string, string][]
  ).toString();

  const inputCls =
    "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
        {t("kicker")}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
        <span className="font-semibold text-emerald-700">
          {t("introAccredited")}
        </span>{" "}
        {t("introBody")}{" "}
        <Link href="/accreditation" className="underline transition-colors duration-150 hover:text-stone-900">
          {t("introLink")}
        </Link>
      </p>

      {/* Filters — a plain GET form, no JavaScript needed */}
      <form
        method="get"
        className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm"
      >
        <input name="q" defaultValue={params.q} placeholder={t("searchPlaceholder")} className={inputCls} />
        <input name="country" defaultValue={params.country} placeholder={t("countryPlaceholder")} className={`${inputCls} w-36`} />
        <select name="focus" defaultValue={params.focus ?? ""} className={inputCls}>
          <option value="">{t("anyFocus")}</option>
          {FOCUS_AREAS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" name="boarding" defaultChecked={params.boarding === "on"} className="rounded border-stone-300" />
          {t("boarding")}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" name="homestay" defaultChecked={params.homestay === "on"} className="rounded border-stone-300" />
          {t("homestay")}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-stone-600">
          <input type="checkbox" name="accredited" defaultChecked={params.accredited === "on"} className="rounded border-stone-300" />
          {t("accreditedOnly")}
        </label>
        <button className="rounded-lg bg-warm-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
          {t("submit")}
        </button>
        {hasFilters && (
          <Link href="/directory" className="text-sm text-stone-500 underline">
            {t("clear")}
          </Link>
        )}
      </form>

      {/* List / map toggle */}
      {mapEnabled && mapSchools.length > 0 && results.length > 0 && (
        <div className="mt-6 flex items-center gap-1 text-sm">
          <Link
            href={`/directory${filterQuery ? `?${filterQuery}` : ""}`}
            className={
              !showMap
                ? "rounded-lg bg-stone-900 px-3.5 py-1.5 font-semibold text-white"
                : "rounded-lg px-3.5 py-1.5 font-medium text-stone-500 transition-colors duration-150 hover:text-stone-900"
            }
          >
            {t("viewList")}
          </Link>
          <Link
            href={`/directory?${filterQuery ? `${filterQuery}&` : ""}view=map`}
            className={
              showMap
                ? "rounded-lg bg-stone-900 px-3.5 py-1.5 font-semibold text-white"
                : "rounded-lg px-3.5 py-1.5 font-medium text-stone-500 transition-colors duration-150 hover:text-stone-900"
            }
          >
            {t("viewMap")}
          </Link>
          {showMap && mapSchools.length < results.length && (
            <span className="ml-2 text-xs text-stone-400">
              {t("unmapped", { count: results.length - mapSchools.length })}
            </span>
          )}
        </div>
      )}

      {showMap ? (
        <div className="mt-4">
          <DirectoryMap schools={mapSchools} />
        </div>
      ) : results.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <h2 className="text-base font-semibold">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
            {t("emptyBody")}
          </p>
          {hasFilters && (
            <Link
              href="/directory"
              className="mt-5 inline-block rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors duration-150 hover:border-stone-400"
            >
              {t("clearAll")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <li key={p.id}>
              <SchoolCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
