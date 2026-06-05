import { createClient } from "@/lib/supabase/server";

// The funnel Tom cares about for the valuation story:
// listings → accreditation applications → approvals → published → enquiries → converted
const FUNNEL: { event: string; label: string }[] = [
  { event: "listing_created", label: "Listings created" },
  { event: "accreditation_applied", label: "Accreditation applications" },
  { event: "application_approved", label: "Applications approved" },
  { event: "profile_published", label: "Profiles published" },
  { event: "enquiry_submitted", label: "Enquiries submitted" },
  { event: "enquiry_converted", label: "Enquiries converted" },
];

export default async function AdminMetrics() {
  const supabase = await createClient();

  // Event counts (funnel activity since launch)
  const counts = new Map<string, number>();
  for (const step of FUNNEL) {
    const { count } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("event", step.event);
    counts.set(step.event, count ?? 0);
  }

  // Current state counts (stock, not flow)
  const [{ count: listedCount }, { count: accreditedCount }, { count: publishedCount }, { count: enquiryCount }] =
    await Promise.all([
      supabase.from("host_profiles").select("*", { count: "exact", head: true }).eq("tier", "listed"),
      supabase.from("host_profiles").select("*", { count: "exact", head: true }).eq("tier", "accredited"),
      supabase.from("host_profiles").select("*", { count: "exact", head: true }).eq("published", true),
      supabase.from("enquiries").select("*", { count: "exact", head: true }),
    ]);

  const { data: countries } = await supabase
    .from("host_profiles")
    .select("country")
    .eq("published", true);
  const countryCount = new Set((countries ?? []).map((c) => c.country)).size;

  const stock = [
    { label: "Listed hosts", value: listedCount ?? 0 },
    { label: "Accredited hosts", value: accreditedCount ?? 0 },
    { label: "Published profiles", value: publishedCount ?? 0 },
    { label: "Countries represented", value: countryCount },
    { label: "Total enquiries", value: enquiryCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        Funnel events are tracked from launch onwards; current state reflects
        everything in the database.
      </p>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
        Current state
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stock.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 p-4">
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="mt-1 text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Funnel activity
      </h2>
      <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
        {FUNNEL.map((step, i) => {
          const value = counts.get(step.event) ?? 0;
          const prev = i > 0 ? (counts.get(FUNNEL[i - 1].event) ?? 0) : null;
          const rate =
            prev != null && prev > 0 ? Math.round((value / prev) * 100) : null;
          return (
            <li key={step.event} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-700">{step.label}</span>
              <span className="text-sm">
                <span className="font-semibold">{value}</span>
                {rate != null && (
                  <span className="ml-2 text-xs text-gray-400">
                    {rate}% of previous step
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-gray-400">
        Note: step-to-step rates are indicative — steps can be skipped (e.g.
        schools applying for accreditation directly without listing first).
      </p>
    </div>
  );
}
