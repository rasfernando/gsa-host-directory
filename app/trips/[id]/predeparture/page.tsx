import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { CATEGORY_LABELS, formatDate } from "@/lib/trips";

export const dynamic = "force-dynamic";

// Step 16: the pre-departure pack. Camp/immersion trips only, and it covers
// every bolt-on in the basket. Printable like the verification statement.
export default async function PreDeparturePage({
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
    redirect(`/login?next=${encodeURIComponent(`/trips/${id}/predeparture`)}`);

  const { data: trip } = await supabase
    .from("trips")
    .select("*, host_profiles(name, country, city)")
    .eq("id", id)
    .single();
  if (!trip) redirect("/trips");

  const [{ data: items }, { data: documents }] = await Promise.all([
    supabase
      .from("trip_items")
      .select("label, category, quantity, predeparture_included")
      .eq("trip_id", id)
      .order("created_at"),
    supabase
      .from("trip_documents")
      .select("*")
      .eq("trip_id", id)
      .order("created_at"),
  ]);

  // Camp/immersion only — there's no pre-departure pack for bolt-ons alone.
  const hasImmersion = (items ?? []).some((i) => i.category === "immersion_camp");
  if (!hasImmersion) notFound();

  const host = Array.isArray(trip.host_profiles)
    ? trip.host_profiles[0]
    : trip.host_profiles;

  // Signed URLs for the private trip documents (1 hour).
  const docsWithUrls = await Promise.all(
    (documents ?? []).map(async (d) => {
      const { data } = await supabase.storage
        .from("trip-docs")
        .createSignedUrl(d.path, 3600);
      return { ...d, url: data?.signedUrl ?? null };
    })
  );
  const nameLists = docsWithUrls.filter((d) => d.kind === "name_list");
  const packs = docsWithUrls.filter((d) => d.kind !== "name_list");

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
          Pre-departure pack
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {trip.organiser_school_name ?? "School"} → {host?.name ?? trip.country}
        </h1>
        <p className="mt-2 text-stone-600">
          Departing {formatDate(trip.start_date)} · {trip.num_days} days ·{" "}
          {trip.num_students} students + {trip.staff_count} staff
        </p>

        <h2 className="mt-8 text-lg font-bold tracking-tight">
          Everything this pack covers
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Your immersion programme plus every bolt-on in the booking.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-stone-700">
          {(items ?? []).map((i) => (
            <li key={i.label} className="flex items-start gap-2">
              <span className="mt-0.5 text-warm-600">✓</span>
              <span>
                <strong>{i.label}</strong>{" "}
                <span className="text-stone-500">
                  ({CATEGORY_LABELS[i.category] ?? i.category} · ×{i.quantity})
                </span>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 text-lg font-bold tracking-tight">Checklist</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
          <li>
            Upload your final name list (full passport names) — it drives
            flight bookings and the final travel pack.
          </li>
          <li>Collect passport + visa copies and EHIC/GHIC details per student.</li>
          <li>Confirm dietary and medical needs with the host school.</li>
          <li>Share the kit list and itinerary with parents.</li>
          <li>
            Final travel pack (tickets, transfers, emergency contacts) arrives
            here once the name list is locked.
          </li>
        </ol>

        <h2 className="mt-8 text-lg font-bold tracking-tight">Documents</h2>
        {packs.length === 0 && nameLists.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">
            Nothing here yet — the GSA team uploads your pack and travel
            documents as departure approaches.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {[...packs, ...nameLists].map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
                    {String(d.kind).replace("_", " ")}
                  </span>{" "}
                  {d.name}
                </span>
                {d.url ? (
                  <a
                    href={d.url}
                    className="text-xs text-brand-700 underline print:hidden"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-stone-400">unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 border-t border-stone-100 pt-4 text-xs text-stone-400">
          Prepared with the Global School Alliance · globalschoolalliance.com
        </p>
      </div>
    </div>
  );
}
