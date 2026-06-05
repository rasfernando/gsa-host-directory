import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { togglePublish } from "../actions";

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
          : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
      }
    >
      {tier}
    </span>
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

export default async function AdminProfiles() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("host_profiles")
    .select(
      "id, name, slug, country, city, published, tier, headline, languages, age_range_min, age_range_max, boarding, homestay, capacity, typical_hosting_windows, created_at, schools(contact_name, contact_email, website)"
    )
    .order("created_at", { ascending: false });

  const list = (data ?? []) as ProfileRow[];
  // New Tier-1 listings awaiting their first review
  const needsReview = list.filter((p) => !p.published && p.tier === "listed");
  const rest = list.filter((p) => p.published || p.tier !== "listed");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Directory profiles</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        {list.filter((p) => p.published).length} published · {list.length} total
      </p>

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
                      <PublishButton profile={p} />
                      <span className="text-xs text-gray-500">
                        Check the website looks real and details are sensible before publishing.
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
              <PublishButton profile={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
