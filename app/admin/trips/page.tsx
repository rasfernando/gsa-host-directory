import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatPounds } from "@/lib/money";
import { TRIP_STATUS_LABELS, TRIP_STATUS_CHIP, formatDate } from "@/lib/trips";

export const dynamic = "force-dynamic";

const NEXT_ACTION: Record<string, string> = {
  draft: "Organiser still planning",
  reserved: "Awaiting deposit — mark paid when received",
  deposit_paid: "Awaiting payment plan commitment",
  invoiced: "Collecting payments",
  confirmed: "Fully paid — prepare pre-departure pack",
  cancelled: "—",
  completed: "—",
};

export default async function AdminTripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/trips");

  const { data: trips } = await supabase
    .from("trips")
    .select(
      `*, host_profiles(name),
       trip_items(line_total_pennies),
       payment_plans(adjusted_total_pennies, deposit_credited_pennies,
         installments(amount_pennies, status)),
       parent_payments(amount_pennies, status)`
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every trip on the platform — deposits, payment plans and balances.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3 font-semibold">Trip</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Basket</th>
              <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
              <th className="px-4 py-3 font-semibold">Next action</th>
            </tr>
          </thead>
          <tbody>
            {(trips ?? []).map((t) => {
              const host = Array.isArray(t.host_profiles)
                ? t.host_profiles[0]
                : t.host_profiles;
              const plan = Array.isArray(t.payment_plans)
                ? t.payment_plans[0]
                : t.payment_plans;
              const subtotal = ((t.trip_items ?? []) as { line_total_pennies: number }[]).reduce(
                (s, i) => s + i.line_total_pennies,
                0
              );
              let outstanding: number | null = null;
              if (plan) {
                const paid =
                  ((plan.installments ?? []) as { amount_pennies: number; status: string }[])
                    .filter((i) => i.status === "paid")
                    .reduce((s, i) => s + i.amount_pennies, 0) +
                  ((t.parent_payments ?? []) as { amount_pennies: number; status: string }[])
                    .filter((p) => p.status === "paid")
                    .reduce((s, p) => s + p.amount_pennies, 0);
                outstanding = Math.max(
                  plan.adjusted_total_pennies - plan.deposit_credited_pennies - paid,
                  0
                );
              }
              return (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/trips/${t.id}`} className="font-medium text-gray-900 hover:underline">
                      {t.organiser_school_name ?? "Unnamed school"}
                    </Link>
                    <span className="block text-xs text-gray-500">
                      → {host?.name ?? t.country ?? "—"} · {formatDate(t.start_date)}
                      {t.num_students ? ` · ${t.num_students} students` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TRIP_STATUS_CHIP[t.status] ?? "bg-stone-100 text-stone-600"}`}
                    >
                      {TRIP_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{subtotal ? formatPounds(subtotal) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {outstanding != null ? formatPounds(outstanding) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {NEXT_ACTION[t.status] ?? "—"}
                  </td>
                </tr>
              );
            })}
            {(trips ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No trips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
