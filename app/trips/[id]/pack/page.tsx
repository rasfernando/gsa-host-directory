import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { formatPounds, splitPennies, planTotal, upfrontTotal } from "@/lib/money";
import { CATEGORY_LABELS, formatDate } from "@/lib/trips";

export const dynamic = "force-dynamic";

// Step 6: the parent launch + presentation pack. Printable, like the
// verification statement.
export default async function ParentPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/trips/${id}/pack`)}`);

  const { data: trip } = await supabase
    .from("trips")
    .select("*, host_profiles(name, country, city, headline, focus_tags)")
    .eq("id", id)
    .single();
  if (!trip) redirect("/trips");

  const host = Array.isArray(trip.host_profiles)
    ? trip.host_profiles[0]
    : trip.host_profiles;

  const { data: items } = await supabase
    .from("trip_items")
    .select("label, category, unit_price_pennies, quantity, line_total_pennies")
    .eq("trip_id", id)
    .order("created_at");

  const subtotal = (items ?? []).reduce((s, i) => s + i.line_total_pennies, 0);
  const parents = trip.parent_count ?? trip.num_students ?? null;
  const perParent = parents && subtotal > 0 ? splitPennies(subtotal, parents)[0] : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/trips/${id}`}
          className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900"
        >
          ← Back to trip
        </Link>
        <PrintButton />
      </div>

      <div className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-wider text-warm-600">
          Parent launch pack
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {trip.organiser_school_name ?? "School"} trip to {host?.name ?? trip.country}
        </h1>
        <p className="mt-2 text-stone-600">
          {formatDate(trip.start_date)} · {trip.num_days} days ·{" "}
          {host?.city ? `${host.city}, ` : ""}
          {host?.country ?? trip.country}
        </p>

        {/* Why this trip */}
        <h2 className="mt-8 text-lg font-bold tracking-tight">Why this trip</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">
          This is a school immersion, not a sightseeing tour: your child joins
          lessons and life at {host?.name ?? "a GSA host school"}, learning
          alongside local students.
          {host?.headline ? ` ${host.headline}` : ""}
        </p>
        {(trip.impact_objectives ?? []).length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {trip.impact_objectives.map((o: string) => (
              <li
                key={o}
                className="rounded-full bg-warm-50 px-3 py-1 text-xs font-medium text-warm-700"
              >
                {o}
              </li>
            ))}
          </ul>
        )}

        {/* What's included */}
        <h2 className="mt-8 text-lg font-bold tracking-tight">
          What&apos;s included
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-stone-700">
          {(items ?? []).map((i) => (
            <li key={i.label} className="flex items-start gap-2">
              <span className="mt-0.5 text-warm-600">✓</span>
              <span>
                <strong>{i.label}</strong>{" "}
                <span className="text-stone-500">
                  ({CATEGORY_LABELS[i.category] ?? i.category})
                </span>
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-warm-600">✓</span>
            <span>
              <strong>Pre-departure pack</strong>{" "}
              <span className="text-stone-500">
                (itinerary, kit list and travel documents before you go)
              </span>
            </span>
          </li>
        </ul>

        {/* Cost per parent */}
        {perParent != null && (
          <>
            <h2 className="mt-8 text-lg font-bold tracking-tight">The cost</h2>
            <div className="mt-3 rounded-xl bg-stone-50 p-5 text-sm leading-relaxed text-stone-700 print:border print:border-stone-200">
              <p>
                Total trip cost{" "}
                <strong>{formatPounds(subtotal)}</strong>, shared between{" "}
                {parents} families —{" "}
                <strong>about {formatPounds(perParent)} per child</strong>.
              </p>
              <p className="mt-2">
                Pay upfront and the school saves 10% (
                {formatPounds(upfrontTotal(subtotal))} total); a monthly payment
                plan is also available (+10%,{" "}
                {formatPounds(planTotal(subtotal))} total). A refundable £1,000
                deposit secures the places.
              </p>
            </div>
          </>
        )}

        {/* What happens next */}
        <h2 className="mt-8 text-lg font-bold tracking-tight">
          What happens next
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
          <li>We confirm the reservation with a refundable £1,000 deposit.</li>
          <li>
            Each family receives an invoice or a personal payment link, with
            the option of monthly instalments.
          </li>
          <li>The first payment confirms your child&apos;s place (non-refundable).</li>
          <li>
            Closer to departure you&apos;ll receive the full pre-departure pack
            and final travel details.
          </li>
        </ol>

        <p className="mt-8 border-t border-stone-100 pt-4 text-xs text-stone-400">
          Prepared with the Global School Alliance · globalschoolalliance.com
        </p>
      </div>
    </div>
  );
}
