import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/trips";
import { getBookedWindows, clashesFor } from "@/lib/availability";
import { reserveTrip, updateTripPlan } from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
const labelCls = "block text-sm font-medium";

// Steps 2–4 of the builder: host school → dates/days/group → review & reserve.
export default async function TripPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const { id } = await params;
  const { step: stepParam, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/trips/${id}/plan`)}`);

  const { data: trip } = await supabase
    .from("trips")
    .select("*, host_profiles(id, name, slug, country, city)")
    .eq("id", id)
    .single();
  if (!trip) redirect("/trips");
  if (trip.status !== "draft") redirect(`/trips/${id}`);

  const host = Array.isArray(trip.host_profiles)
    ? trip.host_profiles[0]
    : trip.host_profiles;

  // Default to the first incomplete step.
  const step =
    stepParam ??
    (!trip.host_profile_id ? "2" : !trip.start_date || !trip.num_students ? "3" : "4");

  const { data: hosts } =
    step === "2"
      ? await supabase
          .from("host_profiles")
          .select("id, name, country, city, tier")
          .eq("published", true)
          .eq("country", trip.country ?? "")
          .order("tier", { ascending: true })
      : { data: null };

  // Availability at the chosen host (steps 3–4): other groups' booked windows
  // and whether the chosen dates clash. Cross-organiser via the RPC.
  const windows =
    step !== "2" && trip.host_profile_id
      ? await getBookedWindows(trip.host_profile_id)
      : [];
  const otherWindows = windows.filter((w) => !w.is_own);
  const clashes =
    trip.start_date
      ? clashesFor(otherWindows, trip.start_date, trip.num_days ?? 1)
      : [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/trips"
        className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900"
      >
        ← My trips
      </Link>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-warm-600">
        Plan a trip · step {step} of 4
      </p>

      {error && (
        <div className="mt-4 rounded-xl bg-warm-50 p-4 text-sm text-warm-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {step === "2" && (
        <>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Choose your host school
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Published GSA hosts in {trip.country ?? "your destination"}. The
            immersion programme runs at this school.
          </p>
          <div className="mt-6 space-y-3">
            {(hosts ?? []).map((h) => (
              <form action={updateTripPlan} key={h.id}>
                <input type="hidden" name="trip_id" value={id} />
                <input type="hidden" name="host_profile_id" value={h.id} />
                <input type="hidden" name="next_step" value="3" />
                <button className="flex w-full items-center justify-between rounded-2xl border border-stone-200/70 bg-white p-5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-warm-300 hover:shadow-md">
                  <span>
                    <span className="block text-sm font-semibold text-stone-900">
                      {h.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {h.city ? `${h.city}, ` : ""}
                      {h.country}
                    </span>
                  </span>
                  {h.tier === "accredited" && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                      GSA Accredited
                    </span>
                  )}
                </button>
              </form>
            ))}
            {(hosts ?? []).length === 0 && (
              <p className="rounded-2xl border border-stone-200/70 bg-white p-5 text-sm text-stone-500">
                No published hosts in {trip.country} yet —{" "}
                <Link href="/directory" className="underline">
                  browse the directory
                </Link>{" "}
                and start again from a school you like.
              </p>
            )}
          </div>
        </>
      )}

      {step === "3" && (
        <>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Dates &amp; group size
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            {host ? `Visiting ${host.name}. ` : ""}Reserving holds 10–30 places
            — you can fine-tune numbers before invoicing.
          </p>
          <form
            action={updateTripPlan}
            className="mt-6 space-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8"
          >
            <input type="hidden" name="trip_id" value={id} />
            <input type="hidden" name="next_step" value="4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="start_date">
                  Start date
                </label>
                <input
                  className={inputCls}
                  id="start_date"
                  name="start_date"
                  type="date"
                  required
                  defaultValue={trip.start_date ?? ""}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="num_days">
                  Number of days
                </label>
                <input
                  className={inputCls}
                  id="num_days"
                  name="num_days"
                  type="number"
                  min={1}
                  max={60}
                  required
                  defaultValue={trip.num_days ?? 5}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls} htmlFor="num_students">
                  Students
                </label>
                <input
                  className={inputCls}
                  id="num_students"
                  name="num_students"
                  type="number"
                  min={1}
                  max={500}
                  required
                  defaultValue={trip.num_students ?? ""}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="staff_count">
                  Accompanying staff
                </label>
                <input
                  className={inputCls}
                  id="staff_count"
                  name="staff_count"
                  type="number"
                  min={0}
                  max={50}
                  defaultValue={trip.staff_count ?? 2}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="parent_count">
                  Paying parents
                </label>
                <input
                  className={inputCls}
                  id="parent_count"
                  name="parent_count"
                  type="number"
                  min={1}
                  max={500}
                  defaultValue={trip.parent_count ?? ""}
                  placeholder="Usually = students"
                />
              </div>
            </div>
            <button className="rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
              Review reservation
            </button>
          </form>
        </>
      )}

      {step === "4" && (
        <>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Reserve your dates
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Reserving adds the immersion to your basket and holds your places.
            Nothing is owed until you confirm with the £1,000 refundable
            deposit.
          </p>
          {clashes.length > 0 && (
            <div className="mt-6 rounded-2xl border border-warm-300 bg-warm-50 p-5">
              <p className="text-sm font-semibold text-warm-800">
                Heads up — {host?.name ?? "this school"} is already hosting
                another group on these dates.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-warm-700">
                {clashes.map((w) => (
                  <li key={w.trip_id}>
                    {formatDate(w.start_date)} – {formatDate(w.end_date)}
                    {w.num_students ? ` · ${w.num_students} students` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-warm-700">
                You can still reserve — the GSA team will confirm the school can
                take both — but you may want to pick a clear week.
              </p>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm sm:grid-cols-3">
              <Fact label="Host school">{host?.name ?? "—"}</Fact>
              <Fact label="Country">{trip.country ?? "—"}</Fact>
              <Fact label="Start date">{formatDate(trip.start_date)}</Fact>
              <Fact label="Days">{trip.num_days ?? "—"}</Fact>
              <Fact label="Students">{trip.num_students ?? "—"}</Fact>
              <Fact label="Staff">{trip.staff_count ?? "—"}</Fact>
            </dl>

            {otherWindows.length > 0 && (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  This school is also hosting
                </p>
                <ul className="mt-2 space-y-1 text-sm text-stone-600">
                  {otherWindows.slice(0, 6).map((w) => (
                    <li key={w.trip_id}>
                      {formatDate(w.start_date)} – {formatDate(w.end_date)}
                      {w.num_students ? ` · ${w.num_students} students` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <form action={reserveTrip}>
                <input type="hidden" name="trip_id" value={id} />
                <button className="rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                  Reserve these dates
                </button>
              </form>
              <Link
                href={`/trips/${id}/plan?step=3`}
                className="text-sm text-stone-500 underline transition-colors duration-150 hover:text-stone-900"
              >
                Change details
              </Link>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-stone-500">
              A reservation holds 10–30 places. Once your deposit is confirmed
              you have 30 days to make the first (non-refundable) payment or
              the booking is released.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 text-stone-800">{children}</dd>
    </div>
  );
}
