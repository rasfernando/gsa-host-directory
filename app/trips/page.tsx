import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPounds } from "@/lib/money";
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUS_CHIP,
  formatDate,
} from "@/lib/trips";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

export const dynamic = "force-dynamic";

const CURRENT_STATUSES = ["draft", "reserved", "deposit_paid", "invoiced", "confirmed"];

function TripCard({ t }: { t: Record<string, unknown> }) {
  const host = Array.isArray(t.host_profiles) ? t.host_profiles[0] : t.host_profiles;
  const plan = Array.isArray(t.payment_plans) ? t.payment_plans[0] : t.payment_plans;
  const items = (t.trip_items ?? []) as { line_total_pennies: number }[];
  const subtotal = items.reduce((s, i) => s + i.line_total_pennies, 0);
  const status = t.status as string;

  let balance: number | null = null;
  let nextDue: { amount: number; date: string | null } | null = null;
  if (plan) {
    const installments = (plan.installments ?? []) as {
      amount_pennies: number;
      status: string;
      due_date: string;
    }[];
    const parentPayments = (t.parent_payments ?? []) as {
      amount_pennies: number;
      status: string;
    }[];
    const paid =
      installments.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount_pennies, 0) +
      parentPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_pennies, 0);
    balance = plan.adjusted_total_pennies - plan.deposit_credited_pennies - paid;
    const upcoming = installments
      .filter((i) => i.status === "pending" || i.status === "overdue")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    if (upcoming) nextDue = { amount: upcoming.amount_pennies, date: upcoming.due_date };
  }

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm transition-all duration-150 hover:border-stone-300 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={`/trips/${t.id}`} className="min-w-0 flex-1">
          <p className="text-base font-semibold text-stone-900">
            {host?.name ?? (t.country as string) ?? "New trip"}
          </p>
          <p className="mt-0.5 text-sm text-stone-500">
            {formatDate(t.start_date as string)}
            {t.num_days ? ` · ${t.num_days} days` : ""}
            {t.num_students ? ` · ${t.num_students} students` : ""}
          </p>
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${TRIP_STATUS_CHIP[status] ?? "bg-stone-100 text-stone-600"}`}
          >
            {TRIP_STATUS_LABELS[status] ?? status}
          </span>
          {status === "draft" && <ConfirmDeleteButton tripId={t.id as string} />}
        </div>
      </div>
      <Link href={`/trips/${t.id}`} className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {subtotal > 0 && (
          <span className="text-stone-600">
            Basket <strong className="text-stone-900">{formatPounds(subtotal)}</strong>
          </span>
        )}
        {balance != null && (
          <span className="text-stone-600">
            Balance{" "}
            <strong className="text-stone-900">{formatPounds(Math.max(balance, 0))}</strong>
          </span>
        )}
        {nextDue && (
          <span className="text-stone-600">
            Next payment <strong className="text-stone-900">{formatPounds(nextDue.amount)}</strong>{" "}
            due {formatDate(nextDue.date)}
          </span>
        )}
      </Link>
    </div>
  );
}

// "My trips": status, balance and the next payment at a glance.
export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/trips");

  const { data: trips } = await supabase
    .from("trips")
    .select(
      `*, host_profiles(name, slug),
       trip_items(line_total_pennies),
       payment_plans(adjusted_total_pennies, deposit_credited_pennies,
         installments(amount_pennies, status, due_date)),
       parent_payments(amount_pennies, status)`
    )
    .order("created_at", { ascending: false });

  const all = (trips ?? []) as Record<string, unknown>[];
  const current = all.filter((t) => CURRENT_STATUSES.includes(t.status as string));
  const completed = all.filter((t) => !CURRENT_STATUSES.includes(t.status as string));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My trips</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Plan, reserve and pay for school immersion trips in one place.
          </p>
        </div>
        <Link
          href="/trips/new"
          className="rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          Plan a trip
        </Link>
      </div>

      {all.length === 0 && (
        <div className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-stone-500">
            No trips yet. Find a host school you love, then build the trip
            around it.
          </p>
          <Link
            href="/directory"
            className="mt-4 inline-block rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            Browse host schools
          </Link>
        </div>
      )}

      {current.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Current
          </h2>
          <div className="mt-3 space-y-4">
            {current.map((t) => (
              <TripCard key={t.id as string} t={t} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Completed &amp; cancelled
          </h2>
          <div className="mt-3 space-y-4 opacity-90">
            {completed.map((t) => (
              <TripCard key={t.id as string} t={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
