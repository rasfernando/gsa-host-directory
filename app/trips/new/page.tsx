import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IMPACT_OBJECTIVES } from "@/lib/trips";
import { createTrip } from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
const labelCls = "block text-sm font-medium";

// Step 1 of the journey: school immersion is the core of the trip;
// pick the destination and what the trip should achieve.
export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  const { host } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/trips/new${host ? `?host=${host}` : ""}`)}`);

  const { data: hostProfile } = host
    ? await supabase
        .from("host_profiles")
        .select("id, name, country, city")
        .eq("slug", host)
        .eq("published", true)
        .single()
    : { data: null };

  const { data: countries } = await supabase
    .from("host_profiles")
    .select("country")
    .eq("published", true);
  const countryOptions = [...new Set((countries ?? []).map((c) => c.country))].sort();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={hostProfile ? `/directory/${host}` : "/trips"}
        className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900"
      >
        ← Back
      </Link>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-warm-600">
        Plan a trip · step 1 of 4
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Start with the school immersion
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        Every GSA trip is built around an immersion at a host school — that&apos;s
        the part that changes students. Flights, attractions and accommodation
        are bolt-ons you can add later.
      </p>

      <form action={createTrip} className="mt-8 space-y-6 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        {hostProfile && (
          <>
            <input type="hidden" name="host_profile_id" value={hostProfile.id} />
            <div className="rounded-xl bg-warm-50 p-4 text-sm text-warm-700">
              Planning a trip to <strong>{hostProfile.name}</strong>
              {hostProfile.city ? `, ${hostProfile.city}` : ""} ({hostProfile.country}).
            </div>
          </>
        )}

        <div>
          <label className={labelCls} htmlFor="organiser_school_name">
            Your school
          </label>
          <input
            className={inputCls}
            id="organiser_school_name"
            name="organiser_school_name"
            required
            placeholder="e.g. Oakwood High School"
          />
        </div>

        {!hostProfile && (
          <div>
            <label className={labelCls} htmlFor="country">
              Destination country
            </label>
            <select className={inputCls} id="country" name="country" required>
              <option value="">Choose a country…</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-stone-500">
              Countries with published GSA host schools.
            </p>
          </div>
        )}

        <fieldset>
          <legend className={labelCls}>What should this trip achieve?</legend>
          <p className="mt-0.5 text-xs text-stone-500">
            Pick the impact objectives that matter — they shape the programme.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {IMPACT_OBJECTIVES.map((o) => (
              <label
                key={o}
                className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 text-sm has-[:checked]:border-warm-400 has-[:checked]:bg-warm-50"
              >
                <input type="checkbox" name="objectives" value={o} className="accent-warm-600" />
                {o}
              </label>
            ))}
          </div>
        </fieldset>

        <button className="w-full rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700 sm:w-auto">
          Continue to dates &amp; group size
        </button>
      </form>
    </div>
  );
}
