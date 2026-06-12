import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { formatPounds, splitPennies } from "@/lib/money";
import { formatDate } from "@/lib/trips";

export const dynamic = "force-dynamic";

// Step 6–7: the parent-launch toolkit. The launch is where trips are won or
// lost, so GSA inserts itself into the school→parent sell: a printable pack,
// a presentation script, copy-paste parent comms, and an agent pack.
export default async function ToolkitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/trips/${id}/toolkit`)}`);

  const { data: trip } = await supabase
    .from("trips")
    .select("*, host_profiles(name, country, city)")
    .eq("id", id)
    .single();
  if (!trip) redirect("/trips");
  const host = Array.isArray(trip.host_profiles)
    ? trip.host_profiles[0]
    : trip.host_profiles;

  const { data: items } = await supabase
    .from("trip_items")
    .select("line_total_pennies")
    .eq("trip_id", id);
  const subtotal = (items ?? []).reduce((s, i) => s + i.line_total_pennies, 0);
  const parents = trip.parent_count ?? trip.num_students ?? null;
  const perParent =
    parents && subtotal > 0 ? splitPennies(subtotal, parents)[0] : null;

  const destination = host?.name ?? trip.country ?? "the host school";
  const dest = `${destination}${host?.country ? `, ${host.country}` : ""}`;
  const when = formatDate(trip.start_date);

  const parentLetter = `Dear parents and carers,

We're excited to share something special: a ${trip.num_days}-day school immersion at ${dest}, departing ${when}. Unlike a sightseeing trip, your child will join lessons and daily life at a host school vetted and verified by the Global School Alliance — learning alongside local students.

${perParent ? `The indicative cost is around ${formatPounds(perParent)} per child, with a monthly payment plan available so it can be spread over the year.` : "Costs and payment plans will be shared at the launch."}

We're holding a parent information session soon — please come along; every question is welcome.

Warm regards,
${trip.organiser_school_name ?? "The trip team"}`;

  const shortMessage = `📣 ${trip.organiser_school_name ?? "School"} trip launch! A ${trip.num_days}-day school immersion at ${dest}, ${when}. Real lessons, real friendships, a GSA-verified host school.${perParent ? ` From ~${formatPounds(perParent)} per child with monthly payment plans.` : ""} Parent session details to follow — reply with questions!`;

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

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-warm-600">
        Parent-launch toolkit
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Launch the trip with parents
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
        Most trips that stall, stall at the parent launch. Use this toolkit —
        and book a 1-2-1 with the GSA team from your trip page if you&apos;d
        like us to help you run it.
      </p>

      {/* The assets */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-900">
            Flyer / presentation pack
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            The printable pack: why this trip, what&apos;s included, the cost
            per child and what happens next.
          </p>
          <Link
            href={`/trips/${id}/pack`}
            className="mt-4 inline-block rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            Open the pack
          </Link>
        </div>
        <div className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-900">Agent pack</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            Working with an agent or partner organisation? The same assets,
            ready to drop into their own collateral.
          </p>
          <p className="mt-4 text-xs text-stone-500">
            Print this page and the pack together — agent-specific branding
            arrives with the agent programme.
          </p>
        </div>
      </section>

      {/* Presentation script */}
      <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">
          Presentation script — 10 minutes
        </h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-stone-700">
          <li>
            <strong>The why (2 min).</strong> &quot;This isn&apos;t a holiday —
            it&apos;s a school immersion. Your child joins lessons at{" "}
            {destination}, makes friends across cultures, and comes back more
            confident than we can make them in a classroom here.&quot; Name the
            objectives: {(trip.impact_objectives ?? []).join(", ") || "cultural immersion and confidence"}.
          </li>
          <li>
            <strong>The trust (2 min).</strong> The host school is verified by
            the Global School Alliance: safeguarding, risk assessment and
            health &amp; safety documentation checked to UK standards, on file
            and auditable. Show the GSA verification statement.
          </li>
          <li>
            <strong>The plan (2 min).</strong> {trip.num_days} days, departing{" "}
            {when}. {trip.num_students} students, {trip.staff_count} staff.
            Walk through a typical day at the host school.
          </li>
          <li>
            <strong>The money (3 min).</strong>{" "}
            {perParent
              ? `About ${formatPounds(perParent)} per child, fully itemised — every line names its supplier. Monthly payment plans are available, and each family can get a personal payment link so nobody has to chase anyone.`
              : "Fully itemised costs — every line names its supplier — with monthly payment plans and per-family payment links."}
          </li>
          <li>
            <strong>The ask (1 min).</strong> &quot;Places are limited —
            we&apos;ve reserved {trip.places_held ?? "the"} places. Tell us
            you&apos;re interested this week, and you&apos;ll get your payment
            link once we confirm.&quot;
          </li>
        </ol>
      </section>

      {/* Parent comms copy */}
      <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">
          Copy for your parent comms
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Paste into your newsletter, parent app or messages — edit freely.
        </p>
        <h3 className="mt-5 text-sm font-semibold text-stone-900">
          Letter / email
        </h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-stone-50 p-5 font-sans text-sm leading-relaxed text-stone-700">
          {parentLetter}
        </pre>
        <h3 className="mt-5 text-sm font-semibold text-stone-900">
          Short message (app / WhatsApp)
        </h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-stone-50 p-5 font-sans text-sm leading-relaxed text-stone-700">
          {shortMessage}
        </pre>
      </section>

      <p className="mt-6 text-xs text-stone-400">
        Prepared with the Global School Alliance · globalschoolalliance.com
      </p>
    </div>
  );
}
