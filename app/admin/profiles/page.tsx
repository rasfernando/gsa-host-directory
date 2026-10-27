import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { geocodeText } from "@/lib/geocode";
import { distanceKm, formatDistance } from "@/lib/geo";
import {
  togglePublish,
  approvePendingChanges,
  discardPendingChanges,
  verifyAndPublish,
  setProfileTier,
  geocodeAllProfiles,
} from "../actions";

type ProfileRow = {
  id: string;
  name: string;
  slug: string;
  country: string;
  city: string | null;
  published: boolean;
  tier: string;
  headline: string | null;
  languages: string[];
  age_band: string | null;
  age_range_min: number | null;
  age_range_max: number | null;
  boarding: boolean;
  homestay: boolean;
  hosted_before: boolean | null;
  host_months: string[] | null;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  typical_hosting_windows: string | null;
  created_at: string;
  pending_review: boolean;
  pending_changes: Record<string, unknown> | null;
  media: { url: string }[] | null;
  schools:
    | { contact_name: string | null; contact_email: string | null; website: string | null }[]
    | { contact_name: string | null; contact_email: string | null; website: string | null }
    | null;
  // computed when a "near" filter is set
  distance_km?: number;
};

// ── Filters (Heather's internal database: dates, location, age range…) ─────
type Filters = {
  near: string;
  km: number;
  country: string;
  age: "" | "primary" | "secondary";
  month: string;
  hosted: "" | "yes" | "no";
  from: string;
  to: string;
  q: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function readFilters(sp: Record<string, string | undefined>): Filters {
  const age = sp.age === "primary" || sp.age === "secondary" ? sp.age : "";
  const hosted = sp.hosted === "yes" || sp.hosted === "no" ? sp.hosted : "";
  const km = Number(sp.km);
  return {
    near: (sp.near ?? "").trim(),
    km: Number.isFinite(km) && km > 0 ? km : 25,
    country: (sp.country ?? "").trim(),
    age,
    month: (sp.month ?? "").trim(),
    hosted,
    from: (sp.from ?? "").trim(),
    to: (sp.to ?? "").trim(),
    q: (sp.q ?? "").trim(),
  };
}

function isActive(f: Filters) {
  return Boolean(f.near || f.country || f.age || f.month || f.hosted || f.from || f.to || f.q);
}

function matchesAge(p: ProfileRow, age: Filters["age"]) {
  if (!age) return true;
  const band = (p.age_band ?? "").toLowerCase();
  if (age === "primary") return band.includes("prim") || (p.age_range_max != null && p.age_range_max <= 11);
  return band.includes("second") || band.includes("sixth") || (p.age_range_min != null && p.age_range_min >= 11);
}

function matchesMonth(p: ProfileRow, month: string) {
  if (!month) return true;
  const want = month.slice(0, 3).toLowerCase();
  return (p.host_months ?? []).some((m) => m.toLowerCase().startsWith(want));
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={
        tier === "accredited"
          ? "rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
          : tier === "verified"
            ? "rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
            : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
      }
    >
      {tier}
    </span>
  );
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// Shows only the fields a school actually changed: live value → proposed value.
function ChangeDiff({ profile }: { profile: ProfileRow }) {
  const pending = profile.pending_changes ?? {};
  const fields: { key: string; label: string; live: unknown }[] = [
    { key: "headline", label: "Headline", live: profile.headline },
    { key: "city", label: "City", live: profile.city },
    { key: "languages", label: "Languages", live: profile.languages },
    { key: "age_range_min", label: "Ages from", live: profile.age_range_min },
    { key: "age_range_max", label: "Ages to", live: profile.age_range_max },
    { key: "capacity", label: "Capacity", live: profile.capacity },
    { key: "boarding", label: "Boarding", live: profile.boarding },
    { key: "homestay", label: "Homestay", live: profile.homestay },
    { key: "typical_hosting_windows", label: "Hosting windows", live: profile.typical_hosting_windows },
  ];

  const changed = fields.filter(
    (f) => f.key in pending && fmt(pending[f.key]) !== fmt(f.live)
  );

  const liveCount = (profile.media ?? []).length;
  const pendingCount = ((pending.media as unknown[]) ?? []).length;
  const photosChanged = "media" in pending && pendingCount !== liveCount;

  if (changed.length === 0 && !photosChanged) {
    return (
      <p className="mt-3 text-xs text-gray-500">
        Minor edits submitted (text wording). Review on the live preview.
      </p>
    );
  }

  return (
    <dl className="mt-3 space-y-1.5 rounded-lg bg-white p-4 text-sm">
      {changed.map((f) => (
        <div key={f.key} className="grid grid-cols-[120px_1fr] gap-2">
          <dt className="text-xs uppercase text-gray-500">{f.label}</dt>
          <dd>
            <span className="text-gray-400 line-through">{fmt(f.live)}</span>{" "}
            <span aria-hidden>→</span>{" "}
            <span className="font-medium text-gray-900">{fmt(pending[f.key])}</span>
          </dd>
        </div>
      ))}
      {photosChanged && (
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <dt className="text-xs uppercase text-gray-500">Photos</dt>
          <dd>
            <span className="text-gray-400 line-through">{liveCount}</span>{" "}
            <span aria-hidden>→</span>{" "}
            <span className="font-medium text-gray-900">{pendingCount} photo(s)</span>
          </dd>
        </div>
      )}
    </dl>
  );
}

function PublishButton({ profile }: { profile: ProfileRow }) {
  return (
    <form action={togglePublish}>
      <input type="hidden" name="profile_id" value={profile.id} />
      <input type="hidden" name="publish" value={String(!profile.published)} />
      <button
        className={
          profile.published
            ? "rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            : "rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700"
        }
      >
        {profile.published ? "Unpublish" : "Publish"}
      </button>
    </form>
  );
}

const fieldCls = "rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs";

function FilterBar({ f, countries, availabilityReady }: { f: Filters; countries: string[]; availabilityReady: boolean }) {
  return (
    <form method="get" className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-gray-600">
          Near
          <input id="f-near" name="near" defaultValue={f.near} placeholder="postcode or place" className={`${fieldCls} mt-1 block w-44`} />
        </label>
        <label className="block text-xs text-gray-600">
          Within (miles)
          <input id="f-km" name="km" type="number" min={1} defaultValue={Math.round(f.km / 1.609)} className={`${fieldCls} mt-1 block w-20`} />
        </label>
        <label className="block text-xs text-gray-600">
          Country
          <select id="f-country" name="country" defaultValue={f.country} className={`${fieldCls} mt-1 block`}>
            <option value="">Any</option>
            {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Age range
          <select id="f-age" name="age" defaultValue={f.age} className={`${fieldCls} mt-1 block`}>
            <option value="">Any</option>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Hosting month
          <select id="f-month" name="month" defaultValue={f.month} className={`${fieldCls} mt-1 block`}>
            <option value="">Any</option>
            {MONTHS.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Hosted before
          <select id="f-hosted" name="hosted" defaultValue={f.hosted} className={`${fieldCls} mt-1 block`}>
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="block text-xs text-gray-600" title={availabilityReady ? "" : "Needs the Directory V1 migration"}>
          Available from
          <input id="f-from" name="from" type="date" defaultValue={f.from} className={`${fieldCls} mt-1 block`} disabled={!availabilityReady} />
        </label>
        <label className="block text-xs text-gray-600">
          to
          <input id="f-to" name="to" type="date" defaultValue={f.to} className={`${fieldCls} mt-1 block`} disabled={!availabilityReady} />
        </label>
        <label className="block text-xs text-gray-600">
          Name
          <input id="f-q" name="q" defaultValue={f.q} placeholder="search" className={`${fieldCls} mt-1 block w-36`} />
        </label>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700">Filter</button>
        {isActive(f) && (
          <Link href="/admin/profiles" className="text-xs text-gray-500 underline">Clear</Link>
        )}
      </div>
      {!availabilityReady && (
        <p className="mt-2 text-xs text-amber-700">
          Date filters are off until supabase/migrations/20261027_directory_v1.sql is applied.
        </p>
      )}
    </form>
  );
}

export default async function AdminProfiles({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { error: errorFlag, geocoded, of } = sp;
  const f = readFilters(sp);
  const supabase = await createClient();

  const { data } = await supabase
    .from("host_profiles")
    .select(
      "id, name, slug, country, city, published, tier, headline, languages, age_band, age_range_min, age_range_max, boarding, homestay, hosted_before, host_months, lat, lng, capacity, typical_hosting_windows, created_at, pending_review, pending_changes, media, schools(contact_name, contact_email, website)"
    )
    .order("created_at", { ascending: false });

  let list = (data ?? []) as ProfileRow[];
  const countries = [...new Set(list.map((p) => p.country).filter(Boolean))].sort();

  // Availability window filter: profiles with an "available" window overlapping
  // the requested range. Table may not exist yet (pre-migration) → filter off.
  let availabilityReady = true;
  let availableIds: Set<string> | null = null;
  if (f.from || f.to) {
    const from = f.from || "0001-01-01";
    const to = f.to || "9999-12-31";
    const { data: windows, error: avErr } = await supabase
      .from("host_availability")
      .select("host_profile_id")
      .eq("status", "available")
      .lte("starts_on", to)
      .gte("ends_on", from);
    if (avErr) availabilityReady = avErr.code !== "42P01";
    else availableIds = new Set((windows ?? []).map((w: { host_profile_id: string }) => w.host_profile_id));
  } else {
    const { error: probe } = await supabase.from("host_availability").select("id").limit(1);
    if (probe?.code === "42P01") availabilityReady = false;
  }

  // "Near": geocode the query once, compute distance per profile, sort by it.
  let nearNote: string | null = null;
  if (f.near) {
    const origin = await geocodeText(f.near);
    if (!origin) {
      nearNote = process.env.GOOGLE_PLACES_API_KEY
        ? `Couldn't find "${f.near}" on the map.`
        : "Location search needs GOOGLE_PLACES_API_KEY.";
    } else {
      list = list
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ ...p, distance_km: distanceKm(origin, { lat: p.lat as number, lng: p.lng as number }) }))
        .filter((p) => (p.distance_km as number) <= f.km)
        .sort((a, b) => (a.distance_km as number) - (b.distance_km as number));
    }
  }

  list = list.filter(
    (p) =>
      (!f.country || p.country === f.country) &&
      matchesAge(p, f.age) &&
      matchesMonth(p, f.month) &&
      (!f.hosted || (f.hosted === "yes" ? p.hosted_before === true : p.hosted_before === false)) &&
      (!availableIds || availableIds.has(p.id)) &&
      (!f.q || p.name.toLowerCase().includes(f.q.toLowerCase()))
  );

  // Live profiles whose schools have submitted edits awaiting re-approval
  const pendingEdits = list.filter((p) => p.pending_review);
  // New Tier-1 listings awaiting their first review
  const needsReview = list.filter((p) => !p.published && p.tier === "listed");
  const rest = list.filter((p) => p.published || p.tier !== "listed");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Directory profiles</h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            {(data ?? []).filter((p: ProfileRow) => p.published).length} published · {(data ?? []).length} total
            {isActive(f) ? ` · ${list.length} match` : ""}
          </p>
        </div>
        <form action={geocodeAllProfiles}>
          <button className="rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-600 hover:border-gray-500">
            Geocode schools for the map
          </button>
        </form>
      </div>

      <FilterBar f={f} countries={countries} availabilityReady={availabilityReady} />

      {nearNote && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{nearNote}</div>
      )}

      {geocoded != null && (
        <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Geocoded {geocoded} of {of} schools missing map locations.
          {geocoded === "0" && of !== "0"
            ? " Is GOOGLE_PLACES_API_KEY set?"
            : ""}
        </div>
      )}

      {errorFlag && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(errorFlag)}
        </div>
      )}

      {pendingEdits.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-600">
            Changes to review ({pendingEdits.length})
          </h2>
          <ul className="space-y-3">
            {pendingEdits.map((p) => (
              <li key={p.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {p.name} <TierBadge tier={p.tier} />
                  </p>
                  <Link href={`/directory/${p.slug}`} target="_blank" className="text-xs text-gray-500 underline">
                    current live version
                  </Link>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  This school edited its live profile. The changes below are
                  <strong> not public</strong> until you approve them.
                </p>
                <ChangeDiff profile={p} />
                <div className="mt-4 flex items-center gap-2">
                  <form action={approvePendingChanges}>
                    <input type="hidden" name="profile_id" value={p.id} />
                    <button className="rounded-lg bg-green-700 px-4 py-2 text-xs font-medium text-white hover:bg-green-800">
                      Approve &amp; publish changes
                    </button>
                  </form>
                  <form action={discardPendingChanges}>
                    <input type="hidden" name="profile_id" value={p.id} />
                    <button className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Discard
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {needsReview.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-600">
            Needs first review ({needsReview.length})
          </h2>
          <ul className="space-y-3">
            {needsReview.map((p) => {
              const school = Array.isArray(p.schools) ? p.schools[0] : p.schools;
              return (
                <li key={p.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {p.name} <TierBadge tier={p.tier} />
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.city ? `${p.city}, ` : ""}
                        {p.country} · listed{" "}
                        {new Date(p.created_at).toLocaleDateString("en-GB")}
                        {p.distance_km != null ? ` · ${formatDistance(p.distance_km)} away` : ""}
                      </p>
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
                      Review submission details
                    </summary>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-white p-4 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs uppercase text-gray-500">Headline</dt><dd>{p.headline || "—"}</dd></div>
                      <div><dt className="text-xs uppercase text-gray-500">Contact</dt><dd>{school?.contact_name} · {school?.contact_email}</dd></div>
                      <div><dt className="text-xs uppercase text-gray-500">Website</dt><dd>{school?.website ? <a href={school.website} target="_blank" className="underline">{school.website}</a> : "—"}</dd></div>
                      <div><dt className="text-xs uppercase text-gray-500">Ages / capacity</dt><dd>{p.age_range_min ?? "?"}–{p.age_range_max ?? "?"} · up to {p.capacity ?? "?"}</dd></div>
                      <div><dt className="text-xs uppercase text-gray-500">Languages</dt><dd>{p.languages?.join(", ") || "—"}</dd></div>
                      <div><dt className="text-xs uppercase text-gray-500">Accommodation</dt><dd>{[p.boarding && "Boarding", p.homestay && "Homestay"].filter(Boolean).join(", ") || "Day visits"}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-xs uppercase text-gray-500">Hosting windows</dt><dd>{p.typical_hosting_windows || "—"}</dd></div>
                    </dl>
                    <div className="mt-3 flex items-center gap-3">
                      <form action={verifyAndPublish}>
                        <input type="hidden" name="profile_id" value={p.id} />
                        <button className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700">
                          Verify &amp; publish
                        </button>
                      </form>
                      <span className="text-xs text-gray-500">
                        Publishing requires verification: confirm the school is
                        real and its details check out first.
                      </span>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        All profiles{isActive(f) ? ` (${rest.length})` : ""}
      </h2>
      {rest.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          {isActive(f) ? "No schools match those filters." : "No profiles yet — approve an application or review a listing."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {rest.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {p.name} <TierBadge tier={p.tier} />
                  {p.distance_km != null && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {formatDistance(p.distance_km)}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {p.city ? `${p.city}, ` : ""}
                  {p.country}
                  {p.age_range_min != null || p.age_range_max != null ? ` · ages ${p.age_range_min ?? "?"}–${p.age_range_max ?? "?"}` : ""}
                  {p.hosted_before === true ? " · hosted before" : ""}
                  {" · "}
                  {p.published ? (
                    <Link href={`/directory/${p.slug}`} className="underline" target="_blank">
                      view live
                    </Link>
                  ) : (
                    "unpublished"
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/profiles/${p.id}/catalogue`}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Catalogue
                </Link>
                <Link
                  href={`/admin/profiles/${p.id}/edit`}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Edit profile
                </Link>
                {p.tier === "verified" && (
                  <form action={setProfileTier}>
                    <input type="hidden" name="profile_id" value={p.id} />
                    <input type="hidden" name="tier" value="accredited" />
                    <button className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Promote to accredited
                    </button>
                  </form>
                )}
                {p.tier === "accredited" && (
                  <form action={setProfileTier}>
                    <input type="hidden" name="profile_id" value={p.id} />
                    <input type="hidden" name="tier" value="verified" />
                    <button className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Set back to verified
                    </button>
                  </form>
                )}
                <PublishButton profile={p} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
