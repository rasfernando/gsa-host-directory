import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { stripeEnabled } from "@/lib/stripe";
import { formatPounds } from "@/lib/money";
import { formatDate } from "@/lib/trips";
import { payParentLink } from "../actions";

export const dynamic = "force-dynamic";

// Public parent payment page. No login: the unguessable token in the URL is
// the credential, and the lookup returns only this parent's own line.
// Fully translated — parents are the most multilingual audience.
export default async function ParentPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; card?: string }>;
}) {
  const { token } = await params;
  const flags = await searchParams;
  const t = await getTranslations("pay");
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
          {t("kicker")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {payment.trip_label}
        </h1>
        <p className="mt-1.5 text-sm text-stone-500">
          {payment.host_name ? `${t("hostedBy", { name: payment.host_name })} · ` : ""}
          {t("departing", { date: formatDate(payment.start_date) })}
        </p>

        <div className="mt-6 rounded-xl bg-stone-50 p-5">
          <p className="text-sm text-stone-600">
            {t("placeFor")} <strong>{payment.parent_name}</strong>
          </p>
          <p className="mt-1 text-3xl font-bold text-stone-900">
            {formatPounds(payment.amount_pennies)}
          </p>
          {payment.due_date && !paid && (
            <p className="mt-1 text-xs text-stone-500">
              {t("dueBy", { date: formatDate(payment.due_date) })}
            </p>
          )}
        </div>

        {paid ? (
          <div className="mt-6 rounded-xl bg-brand-50 p-5 text-sm text-brand-800">
            <p className="font-semibold">{t("paidTitle")}</p>
            <p className="mt-1">
              {t("paidBody", { date: formatDate(payment.paid_at) })}
            </p>
          </div>
        ) : flags.paid === "processing" ? (
          <div className="mt-6 rounded-xl bg-brand-50 p-5 text-sm text-brand-800">
            <p className="font-semibold">{t("processingTitle")}</p>
            <p className="mt-1">{t("processingBody")}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {stripeEnabled() ? (
              <form action={payParentLink}>
                <input type="hidden" name="token" value={token} />
                <button className="w-full rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                  {t("payButton", { amount: formatPounds(payment.amount_pennies) })}
                </button>
              </form>
            ) : (
              <div className="rounded-xl bg-warm-50 p-5 text-sm leading-relaxed text-warm-700">
                {flags.card === "unavailable" ? `${t("cardUnavailable")} ` : ""}
                {t("transferNote")}
              </div>
            )}
            <p className="text-center text-xs text-stone-400">{t("testMode")}</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-stone-400">{t("poweredBy")}</p>
    </div>
  );
}
