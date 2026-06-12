import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPounds } from "@/lib/money";
import { TRIP_STATUS_LABELS, TRIP_STATUS_CHIP, formatDate } from "@/lib/trips";

export const dynamic = "force-dynamic";

// The agent surface: client trips, commission ledger, block-booked
// allocations. Agents enter the journey at the dates/reserve step and use
// the same trip builder as schools — on their client's behalf.
export default async function AgentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/agent");

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!agent) redirect("/trips");

  const [{ data: trips }, { data: commissions }, { data: blocks }] =
    await Promise.all([
      supabase
        .from("trips")
        .select(
          "id, organiser_school_name, status, start_date, num_students, host_profiles(name)"
        )
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("agent_commissions")
        .select("*, trips(organiser_school_name, start_date)")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("block_bookings")
        .select("*, host_profiles(name, country)")
        .eq("agent_id", user.id)
        .order("window_start"),
    ]);

  const payable = (commissions ?? [])
    .filter((c) => c.status === "payable")
    .reduce((s, c) => s + c.amount_pennies, 0);
  const paid = (commissions ?? [])
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount_pennies, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
            Agent hub
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {agent.agency_name}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Commission resale at {(agent.commission_bps / 100).toFixed(1)}% of
            the GSA programme.
            {agent.status === "suspended" && " · Account suspended — contact GSA."}
          </p>
        </div>
        {agent.status === "active" && (
          <Link
            href="/trips/new"
            className="rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            Start a client trip
          </Link>
        )}
      </div>

      {/* Commission summary */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Commission payable
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {formatPounds(payable)}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Paid to date
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {formatPounds(paid)}
          </p>
        </div>
      </div>

      {/* Client trips */}
      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Client trips</h2>
        <div className="mt-3 space-y-3">
          {(trips ?? []).map((t) => {
            const host = Array.isArray(t.host_profiles)
              ? t.host_profiles[0]
              : t.host_profiles;
            return (
              <Link
                key={t.id}
                href={`/trips/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
              >
                <span>
                  <span className="text-sm font-semibold text-stone-900">
                    {t.organiser_school_name ?? "Client school"}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    → {host?.name ?? "—"} · {formatDate(t.start_date)} ·{" "}
                    {t.num_students ?? "—"} students
                  </span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${TRIP_STATUS_CHIP[t.status] ?? "bg-stone-100 text-stone-600"}`}
                >
                  {TRIP_STATUS_LABELS[t.status] ?? t.status}
                </span>
              </Link>
            );
          })}
          {(trips ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
              No client trips yet. Start one from a host school in the{" "}
              <Link href="/directory" className="underline">
                directory
              </Link>{" "}
              — your commission is tracked automatically.
            </p>
          )}
        </div>
      </section>

      {/* Commission ledger */}
      {(commissions ?? []).length > 0 && (
        <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-900">
            Commission ledger
          </h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {(commissions ?? []).map((c) => {
                const t = Array.isArray(c.trips) ? c.trips[0] : c.trips;
                return (
                  <tr key={c.id} className="border-b border-stone-50">
                    <td className="py-2.5">
                      {t?.organiser_school_name ?? "Trip"}
                      <span className="ml-2 text-xs text-stone-500">
                        {formatDate(t?.start_date)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {formatPounds(c.amount_pennies)}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          c.status === "paid"
                            ? "bg-brand-100 text-brand-800"
                            : c.status === "payable"
                              ? "bg-brand-50 text-brand-700"
                              : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {c.status === "pending" ? "pending (trip unpaid)" : c.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Block bookings */}
      <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-900">
          Block-booked allocations
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Allocations GSA has locked for you — that school, that window, is
          yours. Arranged with the GSA team.
        </p>
        <ul className="mt-3 space-y-2">
          {(blocks ?? []).map((b) => {
            const host = Array.isArray(b.host_profiles)
              ? b.host_profiles[0]
              : b.host_profiles;
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium text-stone-900">{host?.name}</span>
                  <span className="ml-2 text-xs text-stone-500">
                    {host?.country} · {formatDate(b.window_start)} –{" "}
                    {formatDate(b.window_end)} · {b.places} places
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    b.status === "active"
                      ? "bg-brand-50 text-brand-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {b.status}
                </span>
              </li>
            );
          })}
          {(blocks ?? []).length === 0 && (
            <li className="text-sm text-stone-500">No allocations yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
