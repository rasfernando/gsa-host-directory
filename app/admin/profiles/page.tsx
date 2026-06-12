import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  togglePublish,
  approvePendingChanges,
  discardPendingChanges,
  verifyAndPublish,
  setProfileTier,
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
  age_range_min: number | null;
  age_range_max: number | null;
  boarding: boolean;
  homestay: boolean;
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
};

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

export default async function AdminProfiles({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorFlag } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("host_profiles")
    .select(
      "id, name, slug, country, city, published, tier, headline, languages, age_range_min, age_range_max, boarding, homestay, capacity, typical_hosting_windows, created_at, pending_review, pending_changes, media, schools(contact_name, contact_email, website)"
    )
    .order("created_at", { ascending: false });

  const list = (data ?? []) as ProfileRow[];
  // Live profiles whose schools have submitted edits awaiting re-approval
  const pendingEdits = list.filter((p) => p.pending_review);
  // New Tier-1 listings awaiting their first review
  const needsReview = list.filter((p) => !p.published && p.tier === "listed");
  const rest = list.filter((p) => p.published || p.tier !== "listed");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Directory profiles</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        {list.filter((p) => p.published).length} published · {list.length} total
      </p>

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
        All profiles
      </h2>
      {rest.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          No profiles yet — approve an application or review a listing.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {rest.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium">
                  {p.name} <TierBadge tier={p.tier} />
                </p>
                <p className="text-xs text-gray-500">
                  {p.city ? `${p.city}, ` : ""}
                  {p.country}
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
              <div className="flex items-center gap-2">
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
