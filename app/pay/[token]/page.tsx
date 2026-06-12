import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripeEnabled } from "@/lib/stripe";
import { formatPounds } from "@/lib/money";
import { formatDate } from "@/lib/trips";
import { payParentLink } from "../actions";

export const dynamic = "force-dynamic";

// Public parent payment page. No login: the unguessable token in the URL is
// the credential, and the lookup returns only this parent's own line.
export default async function ParentPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; card?: string }>;
}) {
  const { token } = await params;
  const flags = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.rpc("parent_payment_by_token", {
    p_token: token,
  });
  const payment = Array.isArray(data) ? data[0] : data;
  if (!payment) notFound();

  const paid = payment.status === "paid";

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-stone-200/70 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-warm-600">
          School trip payment
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {payment.trip_label}
        </h1>
        <p className="mt-1.5 text-sm text-stone-500">
          {payment.host_name ? `Hosted by ${payment.host_name} · ` : ""}
          departing {formatDate(payment.start_date)}
        </p>

        <div className="mt-6 rounded-xl bg-stone-50 p-5">
          <p className="text-sm text-stone-600">
            Place for <strong>{payment.parent_name}</strong>
          </p>
          <p className="mt-1 text-3xl font-bold text-stone-900">
            {formatPounds(payment.amount_pennies)}
          </p>
          {payment.due_date && !paid && (
            <p className="mt-1 text-xs text-stone-500">
              Due by {formatDate(payment.due_date)}
            </p>
          )}
        </div>

        {paid ? (
          <div className="mt-6 rounded-xl bg-brand-50 p-5 text-sm text-brand-800">
            <p className="font-semibold">Paid — thank you!</p>
            <p className="mt-1">
              Received {formatDate(payment.paid_at)}. This page is your
            receipt; you&apos;ll also get the pre-departure pack via the school.
            </p>
          </div>
        ) : flags.paid === "processing" ? (
          <div className="mt-6 rounded-xl bg-brand-50 p-5 text-sm text-brand-800">
            <p className="font-semibold">Payment processing</p>
            <p className="mt-1">
              Thanks — your card payment is being confirmed. This page will
              show as paid once it clears.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {stripeEnabled() ? (
              <form action={payParentLink}>
                <input type="hidden" name="token" value={token} />
                <button className="w-full rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                  Pay {formatPounds(payment.amount_pennies)} by card
                </button>
              </form>
            ) : (
              <div className="rounded-xl bg-warm-50 p-5 text-sm leading-relaxed text-warm-700">
                {flags.card === "unavailable"
                  ? "Card payments are temporarily unavailable. "
                  : ""}
                Pay by bank transfer using the details on your school&apos;s
                trip letter — the GSA team will confirm your payment here
                within a working day.
              </div>
            )}
            <p className="text-center text-xs text-stone-400">
              Test mode — no real money moves through this page.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-stone-400">
        Powered by the Global School Alliance
      </p>
    </div>
  );
}
