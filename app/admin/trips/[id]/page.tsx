import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPounds } from "@/lib/money";
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUS_CHIP,
  CATEGORY_LABELS,
  formatDate,
} from "@/lib/trips";
import {
  adminMarkDepositPaid,
  adminMarkInstallmentPaid,
  adminMarkParentPaymentPaid,
  sendInstallmentReminder,
  sendParentReminder,
  setInvoiceStatus,
  addCustomLine,
  decideAlteration,
  uploadTripDocument,
  deleteTripDocument,
  adminCompleteTrip,
} from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-gray-500 focus:outline-none";

export default async function AdminTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/admin/trips/${id}`)}`);

  const { data: trip } = await supabase
    .from("trips")
    .select("*, host_profiles(name, slug)")
    .eq("id", id)
    .single();
  if (!trip) notFound();
  const host = Array.isArray(trip.host_profiles)
    ? trip.host_profiles[0]
    : trip.host_profiles;

  const [
    { data: organiser },
    { data: items },
    { data: plan },
    { data: parentPayments },
    { data: invoices },
    { data: alterations },
    { data: documents },
    { data: suppliers },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("email, full_name")
      .eq("id", trip.organiser_id)
      .single(),
    supabase
      .from("trip_items")
      .select("*")
      .eq("trip_id", id)
      .order("created_at"),
    supabase
      .from("payment_plans")
      .select("*, installments(*)")
      .eq("trip_id", id)
      .maybeSingle(),
    supabase.from("parent_payments").select("*").eq("trip_id", id).order("created_at"),
    supabase.from("invoices").select("*").eq("trip_id", id).order("issued_at"),
    supabase.from("trip_alterations").select("*").eq("trip_id", id).order("created_at"),
    supabase.from("trip_documents").select("*").eq("trip_id", id).order("created_at"),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);

  type Installment = {
    id: string;
    seq: number;
    due_date: string;
    amount_pennies: number;
    status: string;
    paid_at: string | null;
    reminder_sent_at: string | null;
  };
  const installments = ((plan?.installments ?? []) as Installment[])
    .slice()
    .sort((a, b) => a.seq - b.seq);
  const subtotal = (items ?? []).reduce((s, i) => s + i.line_total_pennies, 0);

  return (
    <div>
      <Link href="/admin/trips" className="text-sm text-gray-500 hover:text-gray-900">
        ← All trips
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {trip.organiser_school_name ?? "Unnamed school"} →{" "}
            {host?.name ?? trip.country}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {organiser?.full_name || organiser?.email || "Unknown organiser"} ·{" "}
            {formatDate(trip.start_date)} · {trip.num_days} days ·{" "}
            {trip.num_students} students · {trip.parent_count ?? "—"} parents
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${TRIP_STATUS_CHIP[trip.status] ?? "bg-stone-100 text-stone-600"}`}
        >
          {TRIP_STATUS_LABELS[trip.status] ?? trip.status}
        </span>
      </div>

      {flags.saved && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved.
        </div>
      )}
      {flags.error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(flags.error)}
        </div>
      )}

      {/* Deposit */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Deposit</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {formatPounds(trip.deposit_amount_pennies)} ·{" "}
              {trip.deposit_status === "paid"
                ? `paid — clock runs to ${formatDate(trip.cancellation_deadline)}`
                : trip.deposit_status === "refunded"
                  ? "refunded"
                  : "not yet received"}
              {trip.places_held ? ` · ${trip.places_held} places held` : ""}
            </p>
          </div>
          {trip.status === "reserved" && trip.deposit_status === "none" && (
            <form action={adminMarkDepositPaid} className="flex items-center gap-2">
              <input type="hidden" name="trip_id" value={id} />
              <input name="ref" placeholder="Payment ref (optional)" className={inputCls} />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                Mark deposit paid
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Basket */}
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Basket</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id} className="border-b border-gray-50">
                <td className="py-2">
                  {i.label}
                  <span className="ml-2 text-xs text-gray-400">
                    {CATEGORY_LABELS[i.category] ?? i.category}
                  </span>
                </td>
                <td className="py-2 text-right text-gray-500">
                  {formatPounds(i.unit_price_pennies)} × {i.quantity}
                </td>
                <td className="py-2 pl-6 text-right font-medium">
                  {formatPounds(i.line_total_pennies)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2.5 font-semibold">Total</td>
              <td />
              <td className="py-2.5 pl-6 text-right text-base font-bold">
                {formatPounds(subtotal)}
              </td>
            </tr>
          </tbody>
        </table>

        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-900">
            Add a custom line (GSA price)
          </summary>
          <form action={addCustomLine} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="trip_id" value={id} />
            <label className="text-xs text-gray-600">
              Label
              <input name="label" required className={`${inputCls} mt-1 block w-44`} />
            </label>
            <label className="text-xs text-gray-600">
              Supplier
              <select name="supplier_id" className={`${inputCls} mt-1 block`}>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Category
              <select name="category" className={`${inputCls} mt-1 block`}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Unit price £
              <input
                name="unit_price_pounds"
                type="number"
                step="0.01"
                min="0"
                required
                className={`${inputCls} mt-1 block w-24`}
              />
            </label>
            <label className="text-xs text-gray-600">
              Qty
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue={1}
                className={`${inputCls} mt-1 block w-16`}
              />
            </label>
            <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
              Add line
            </button>
          </form>
        </details>
      </section>

      {/* Payments */}
      {plan && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Payment plan — {plan.choice === "upfront" ? "upfront (−10%)" : "instalments (+10%)"}{" "}
            via {plan.mode === "school_invoice" ? "school invoice" : "parent links"}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            GSA programme {formatPounds(plan.base_total_pennies)}
            {plan.service_fee_pennies > 0 &&
              ` + service fee ${formatPounds(plan.service_fee_pennies)}`}{" "}
            → committed {formatPounds(plan.adjusted_total_pennies)} · deposit
            credit {formatPounds(plan.deposit_credited_pennies)} · first
            payment due {formatDate(plan.first_payment_due)} (non-refundable
            service fee)
          </p>

          {plan.mode === "school_invoice" && (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {installments.map((ins) => (
                  <tr key={ins.id as string} className="border-b border-gray-50">
                    <td className="py-2.5">Payment {ins.seq as number}</td>
                    <td className="py-2.5 text-gray-500">
                      due {formatDate(ins.due_date as string)}
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {formatPounds(ins.amount_pennies as number)}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      {(ins.status as string) === "paid" ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          paid {formatDate(ins.paid_at as string)}
                        </span>
                      ) : (ins.status as string) === "cancelled" ? (
                        <span className="text-xs text-gray-400">cancelled</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {(ins.reminder_sent_at as string) && (
                            <span className="text-[11px] text-gray-400">
                              reminded {formatDate(ins.reminder_sent_at as string)}
                            </span>
                          )}
                          <form action={sendInstallmentReminder} className="inline">
                            <input type="hidden" name="trip_id" value={id} />
                            <input type="hidden" name="installment_id" value={ins.id as string} />
                            <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-500">
                              Remind
                            </button>
                          </form>
                          <form action={adminMarkInstallmentPaid} className="inline">
                            <input type="hidden" name="trip_id" value={id} />
                            <input type="hidden" name="installment_id" value={ins.id as string} />
                            <button className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700">
                              Mark paid
                            </button>
                          </form>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {plan.mode === "parent_links" && (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {(parentPayments ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-2.5">
                      {p.parent_name}
                      {p.parent_email && (
                        <span className="ml-2 text-xs text-gray-400">{p.parent_email}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {formatPounds(p.amount_pennies)}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      {p.status === "paid" ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          paid {formatDate(p.paid_at)}
                        </span>
                      ) : p.status === "cancelled" ? (
                        <span className="text-xs text-gray-400">cancelled</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <a
                            href={`/pay/${p.token}`}
                            className="text-xs text-gray-500 underline"
                          >
                            link
                          </a>
                          {p.parent_email && (
                            <form action={sendParentReminder} className="inline">
                              <input type="hidden" name="trip_id" value={id} />
                              <input type="hidden" name="payment_id" value={p.id} />
                              <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-500">
                                Remind
                              </button>
                            </form>
                          )}
                          <form action={adminMarkParentPaymentPaid} className="inline">
                            <input type="hidden" name="trip_id" value={id} />
                            <input type="hidden" name="payment_id" value={p.id} />
                            <button className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700">
                              Mark paid
                            </button>
                          </form>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {(invoices ?? []).length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Invoices
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(invoices ?? []).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3">
                    <span>
                      <Link
                        href={`/trips/${id}/invoice/${inv.id}`}
                        className="text-gray-900 underline"
                      >
                        {inv.invoice_number}
                      </Link>{" "}
                      · {formatPounds(inv.amount_pennies)} · {inv.status}
                    </span>
                    {inv.status === "issued" && (
                      <span className="flex gap-2">
                        <form action={setInvoiceStatus}>
                          <input type="hidden" name="trip_id" value={id} />
                          <input type="hidden" name="invoice_id" value={inv.id} />
                          <input type="hidden" name="status" value="paid" />
                          <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-500">
                            Mark paid
                          </button>
                        </form>
                        <form action={setInvoiceStatus}>
                          <input type="hidden" name="trip_id" value={id} />
                          <input type="hidden" name="invoice_id" value={inv.id} />
                          <input type="hidden" name="status" value="void" />
                          <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-500">
                            Void
                          </button>
                        </form>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Alterations */}
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Booking alterations</h2>
        {(alterations ?? []).length === 0 && (
          <p className="mt-1 text-sm text-gray-500">None requested.</p>
        )}
        <ul className="mt-2 space-y-3">
          {(alterations ?? []).map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-100 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-900">{a.description}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    a.status === "applied"
                      ? "bg-emerald-50 text-emerald-700"
                      : a.status === "rejected"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Requested {formatDate(a.created_at)}
                {a.price_delta_pennies !== 0 &&
                  ` · price delta ${a.price_delta_pennies > 0 ? "+" : "−"}${formatPounds(Math.abs(a.price_delta_pennies))}`}
                {a.admin_notes ? ` · ${a.admin_notes}` : ""}
              </p>
              {a.status === "requested" && (
                <form
                  action={decideAlteration}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="trip_id" value={id} />
                  <input type="hidden" name="alteration_id" value={a.id} />
                  <label className="text-xs text-gray-600">
                    Price delta £ (±)
                    <input
                      name="price_delta_pounds"
                      type="number"
                      step="0.01"
                      defaultValue={0}
                      className={`${inputCls} mt-1 block w-28`}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Notes
                    <input name="admin_notes" className={`${inputCls} mt-1 block w-56`} />
                  </label>
                  <button
                    name="decision"
                    value="approve"
                    className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700"
                  >
                    Approve &amp; apply
                  </button>
                  <button
                    name="decision"
                    value="reject"
                    className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-600 hover:border-gray-500"
                  >
                    Reject
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Documents */}
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Documents — packs, name lists, travel packs
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {(documents ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3">
              <span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                  {String(d.kind).replace("_", " ")}
                </span>{" "}
                {d.name}
                <span className="ml-2 text-xs text-gray-400">
                  {formatDate(d.created_at)}
                </span>
              </span>
              <form action={deleteTripDocument}>
                <input type="hidden" name="trip_id" value={id} />
                <input type="hidden" name="doc_id" value={d.id} />
                <button className="text-xs text-gray-400 hover:text-red-600">Delete</button>
              </form>
            </li>
          ))}
          {(documents ?? []).length === 0 && (
            <li className="text-sm text-gray-500">Nothing uploaded yet.</li>
          )}
        </ul>
        <form
          action={uploadTripDocument}
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3"
        >
          <input type="hidden" name="trip_id" value={id} />
          <label className="text-xs text-gray-600">
            Kind
            <select name="kind" className={`${inputCls} mt-1 block`}>
              <option value="predeparture_pack">Pre-departure pack</option>
              <option value="travel_pack">Travel pack</option>
              <option value="parent_pack">Parent pack</option>
              <option value="name_list">Name list</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">
            File
            <input name="document" type="file" required className="mt-1 block text-xs" />
          </label>
          <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Upload
          </button>
        </form>
      </section>

      {/* Lifecycle */}
      {trip.status === "confirmed" && (
        <section className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Trip fully paid. Once it has run, mark it completed.
          </p>
          <form action={adminCompleteTrip}>
            <input type="hidden" name="trip_id" value={id} />
            <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-500">
              Mark completed
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
