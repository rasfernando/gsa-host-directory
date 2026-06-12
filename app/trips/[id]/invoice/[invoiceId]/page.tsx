import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { formatPounds } from "@/lib/money";
import { CATEGORY_LABELS, formatDate } from "@/lib/trips";

export const dynamic = "force-dynamic";

// Printable invoice — same print treatment as the verification statement.
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const { id, invoiceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/trips/${id}/invoice/${invoiceId}`)}`);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("trip_id", id)
    .single();
  if (!invoice) notFound();

  const [{ data: trip }, { data: items }, { data: planData }] = await Promise.all([
    supabase
      .from("trips")
      .select("*, host_profiles(name, country, city)")
      .eq("id", id)
      .single(),
    supabase
      .from("trip_items")
      .select("label, category, unit_price_pennies, quantity, line_total_pennies")
      .eq("trip_id", id)
      .order("created_at"),
    supabase.from("payment_plans").select("*").eq("trip_id", id).single(),
  ]);
  if (!trip) notFound();
  const plan = planData;
  const host = Array.isArray(trip.host_profiles)
    ? trip.host_profiles[0]
    : trip.host_profiles;

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Invoice
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {invoice.invoice_number}
            </h1>
          </div>
          <span
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              invoice.status === "paid"
                ? "bg-brand-700 text-white"
                : invoice.status === "void"
                  ? "bg-stone-200 text-stone-500"
                  : "bg-warm-50 text-warm-700"
            }`}
          >
            {invoice.status}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <Fact label="Billed to">{trip.organiser_school_name ?? "School"}</Fact>
          <Fact label="Trip">
            {host?.name ?? trip.country} · {formatDate(trip.start_date)}
          </Fact>
          <Fact label="Issued">{formatDate(invoice.issued_at)}</Fact>
          <Fact label="Due">{formatDate(invoice.due_date)}</Fact>
        </dl>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wider text-stone-500">
              <th className="py-2.5 font-semibold">Item</th>
              <th className="py-2.5 text-right font-semibold">Unit</th>
              <th className="py-2.5 text-right font-semibold">Qty</th>
              <th className="py-2.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.label} className="border-b border-stone-100">
                <td className="py-3">
                  {i.label}
                  <span className="block text-xs text-stone-500">
                    {CATEGORY_LABELS[i.category] ?? i.category}
                  </span>
                </td>
                <td className="py-3 text-right text-stone-600">
                  {formatPounds(i.unit_price_pennies)}
                </td>
                <td className="py-3 text-right text-stone-600">×{i.quantity}</td>
                <td className="py-3 text-right font-medium">
                  {formatPounds(i.line_total_pennies)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            {plan && (
              <>
                <tr>
                  <td colSpan={3} className="py-2.5 text-right text-stone-600">
                    Subtotal
                  </td>
                  <td className="py-2.5 text-right">
                    {formatPounds(plan.base_total_pennies)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2.5 text-right text-stone-600">
                    {plan.choice === "upfront"
                      ? "Upfront discount (−10%)"
                      : "Payment plan (+10%)"}
                  </td>
                  <td className="py-2.5 text-right">
                    {plan.adjustment_pennies < 0 ? "−" : "+"}
                    {formatPounds(Math.abs(plan.adjustment_pennies))}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2.5 text-right text-stone-600">
                    Deposit credited
                  </td>
                  <td className="py-2.5 text-right">
                    −{formatPounds(plan.deposit_credited_pennies)}
                  </td>
                </tr>
              </>
            )}
            <tr className="border-t border-stone-200">
              <td colSpan={3} className="py-4 text-right font-semibold text-stone-900">
                Amount due
              </td>
              <td className="py-4 text-right text-lg font-bold text-stone-900">
                {formatPounds(invoice.amount_pennies)}
              </td>
            </tr>
          </tfoot>
        </table>

        {invoice.notes && (
          <p className="mt-2 text-xs text-stone-500">{invoice.notes}</p>
        )}
        <p className="mt-8 border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-400">
          The first payment is non-refundable and is due within 30 days of
          deposit confirmation. Issued by the Global School Alliance ·
          globalschoolalliance.com · Test mode — this is a demo document.
        </p>
      </div>
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
