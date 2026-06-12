import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatPounds,
  upfrontTotal,
  planTotal,
  splitPennies,
  DEPOSIT_PENNIES,
} from "@/lib/money";
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUS_CHIP,
  CATEGORY_LABELS,
  formatDate,
  daysUntil,
} from "@/lib/trips";
import {
  addItem,
  removeItem,
  requestLaunchCall,
  cancelTrip,
  payDeposit,
  commitPlan,
  payInstallment,
} from "../actions";
import { stripeEnabled } from "@/lib/stripe";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  label: string;
  category: string;
  unit_price_pennies: number;
  quantity: number;
  line_total_pennies: number;
  product_id: string | null;
};

type Product = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  unit_price_pennies: number;
  pricing_unit: string;
  tier: string | null;
  bolt_on: boolean;
  suppliers: { name: string } | { name: string }[] | null;
};

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    reserved?: string;
    call?: string;
    cancelled?: string;
    error?: string;
    deposit?: string;
    committed?: string;
    payment?: string;
  }>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/trips/${id}`)}`);

  const { data: trip } = await supabase
    .from("trips")
    .select("*, host_profiles(id, name, slug, country, city)")
    .eq("id", id)
    .single();
  if (!trip) redirect("/trips");
  if (trip.status === "draft") redirect(`/trips/${id}/plan`);

  const host = Array.isArray(trip.host_profiles)
    ? trip.host_profiles[0]
    : trip.host_profiles;

  const [
    { data: itemsData },
    { data: boltOnsData },
    { data: planData },
    { data: parentPaymentsData },
    { data: invoicesData },
  ] = await Promise.all([
    supabase
      .from("trip_items")
      .select("id, label, category, unit_price_pennies, quantity, line_total_pennies, product_id")
      .eq("trip_id", id)
      .order("created_at"),
    supabase
      .from("products")
      .select(
        "id, type, name, description, unit_price_pennies, pricing_unit, tier, bolt_on, suppliers(name)"
      )
      .eq("active", true)
      .eq("bolt_on", true)
      .order("type")
      .order("unit_price_pennies"),
    supabase
      .from("payment_plans")
      .select("*, installments(*)")
      .eq("trip_id", id)
      .maybeSingle(),
    supabase
      .from("parent_payments")
      .select("*")
      .eq("trip_id", id)
      .order("created_at"),
    supabase
      .from("invoices")
      .select("*")
      .eq("trip_id", id)
      .order("issued_at"),
  ]);
  const items = (itemsData ?? []) as Item[];
  const boltOns = (boltOnsData ?? []) as Product[];
  const plan = planData;
  const installments = ((plan?.installments ?? []) as {
    id: string;
    seq: number;
    due_date: string;
    amount_pennies: number;
    status: string;
    paid_at: string | null;
  }[]).sort((a, b) => a.seq - b.seq);
  const parentPayments = parentPaymentsData ?? [];
  const invoices = invoicesData ?? [];
  const canPayByCard = stripeEnabled();
  const origin =
    (await headers()).get("x-forwarded-host") != null
      ? `https://${(await headers()).get("x-forwarded-host")}`
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const subtotal = items.reduce((s, i) => s + i.line_total_pennies, 0);
  const parents = trip.parent_count ?? trip.num_students ?? null;
  const perParent = parents ? splitPennies(subtotal, parents)[0] : null;

  const basketOpen = ["reserved", "deposit_paid"].includes(trip.status);
  const inBasket = new Set(items.map((i) => i.product_id).filter(Boolean));
  const clockDays = daysUntil(trip.cancellation_deadline);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/trips"
        className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900"
      >
        ← My trips
      </Link>

      {/* Header */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {host?.name ?? "Your trip"}
          </h1>
          <p className="mt-1.5 text-stone-500">
            {trip.organiser_school_name ? `${trip.organiser_school_name} · ` : ""}
            {formatDate(trip.start_date)} · {trip.num_days} days ·{" "}
            {trip.num_students} students
          </p>
        </div>
        <span
          className={`shrink-0 self-start rounded-full px-3.5 py-1.5 text-xs font-semibold ${TRIP_STATUS_CHIP[trip.status] ?? "bg-stone-100 text-stone-600"}`}
        >
          {TRIP_STATUS_LABELS[trip.status] ?? trip.status}
        </span>
      </div>

      {/* Flash messages */}
      {flags.reserved && (
        <Flash tone="ok">
          Dates reserved — {trip.places_held} places held. Confirm with the{" "}
          {formatPounds(DEPOSIT_PENNIES)} refundable deposit to lock them in.
        </Flash>
      )}
      {flags.call && (
        <Flash tone="ok">
          Call requested — the GSA team will be in touch to arrange your 1-2-1
          and parent-launch support.
        </Flash>
      )}
      {flags.cancelled && <Flash tone="warn">This trip has been cancelled.</Flash>}
      {flags.error && <Flash tone="warn">{decodeURIComponent(flags.error)}</Flash>}
      {flags.deposit === "processing" && (
        <Flash tone="ok">
          Deposit payment processing — your reservation will be confirmed as
          soon as it clears.
        </Flash>
      )}
      {flags.deposit === "manual" && (
        <Flash tone="ok">
          Card payments aren&apos;t configured yet — the GSA team has been
          notified and will arrange the deposit by bank transfer, then confirm
          it here.
        </Flash>
      )}
      {flags.payment === "processing" && (
        <Flash tone="ok">Payment processing — it will show below once it clears.</Flash>
      )}
      {flags.committed && (
        <Flash tone="ok">
          Payment plan committed — your{" "}
          {trip.payment_mode === "parent_links"
            ? "parent payment links are ready below"
            : "invoice has been issued below"}
          .
        </Flash>
      )}

      {/* Reservation status */}
      {trip.status !== "cancelled" && (
        <div className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">
                {trip.places_held
                  ? `${trip.places_held} places held`
                  : "Reservation"}
                {trip.reserved_at ? ` · reserved ${formatDate(trip.reserved_at)}` : ""}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {trip.deposit_status === "paid" ? (
                  <>
                    Deposit of {formatPounds(trip.deposit_amount_pennies)} paid
                    {clockDays != null && trip.status === "deposit_paid" && (
                      <>
                        {" "}
                        — <strong>{Math.max(clockDays, 0)} days</strong> to
                        commit your payment plan and make the first
                        (non-refundable) payment.
                      </>
                    )}
                  </>
                ) : trip.status === "reserved" ? (
                  <>
                    Next: confirm with the {formatPounds(DEPOSIT_PENNIES)}{" "}
                    refundable deposit.
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Basket */}
      <section id="basket" className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Your basket</h2>
        <p className="mt-1 text-sm text-stone-500">
          Itemised across suppliers. Prices come from the GSA catalogue.
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-[11px] uppercase tracking-wider text-stone-500">
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-3 py-3 text-right font-semibold">Unit</th>
                <th className="px-3 py-3 text-right font-semibold">Qty</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
                {basketOpen && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-stone-50">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-stone-900">{i.label}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {CATEGORY_LABELS[i.category] ?? i.category}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right text-stone-600">
                    {formatPounds(i.unit_price_pennies)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-stone-600">
                    ×{i.quantity}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-stone-900">
                    {formatPounds(i.line_total_pennies)}
                  </td>
                  {basketOpen && (
                    <td className="pr-3 text-right">
                      {i.category !== "immersion_camp" && (
                        <form action={removeItem}>
                          <input type="hidden" name="trip_id" value={id} />
                          <input type="hidden" name="item_id" value={i.id} />
                          <button
                            className="text-stone-400 transition-colors duration-150 hover:text-warm-700"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-stone-500">
                    Basket is empty.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-5 py-4 font-semibold text-stone-900">Total</td>
                <td colSpan={basketOpen ? 4 : 3} className="px-5 py-4 text-right text-lg font-bold text-stone-900">
                  {formatPounds(subtotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {parents && subtotal > 0 && (
          <p className="mt-3 text-sm text-stone-600">
            Split between {parents} parents ≈{" "}
            <strong>{formatPounds(perParent!)} per parent</strong>.
          </p>
        )}
      </section>

      {/* Bolt-ons */}
      {basketOpen && (
        <section className="mt-8">
          <h2 className="text-xl font-bold tracking-tight">
            Upgrades &amp; bolt-ons
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Flights, attractions and accommodation from GSA&apos;s travel
            partners. Accommodation is a choice — budget or quality.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {boltOns.map((p) => {
              const supplier = Array.isArray(p.suppliers)
                ? p.suppliers[0]
                : p.suppliers;
              const added = inBasket.has(p.id);
              return (
                <div
                  key={p.id}
                  className="flex flex-col rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-900">{p.name}</p>
                    {p.tier && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          p.tier === "premium" || p.tier === "quality"
                            ? "bg-warm-50 text-warm-700"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {p.tier}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {supplier?.name} · {formatPounds(p.unit_price_pennies)}
                    {p.pricing_unit === "per_place" ? " per place" : ""}
                  </p>
                  {p.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-3 flex-1" />
                  {added ? (
                    <p className="text-xs font-semibold text-brand-700">
                      ✓ In your basket
                    </p>
                  ) : (
                    <form action={addItem}>
                      <input type="hidden" name="trip_id" value={id} />
                      <input type="hidden" name="product_id" value={p.id} />
                      <button className="rounded-lg border border-warm-600 px-4 py-2 text-xs font-semibold text-warm-700 transition-colors duration-150 hover:bg-warm-50">
                        {p.type === "accommodation" ? "Choose this stay" : "Add to basket"}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Step 8: confirm the reservation with the deposit */}
      {trip.status === "reserved" && (
        <section className="mt-8 rounded-2xl border border-warm-200/70 bg-warm-50/50 p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold tracking-tight">
            Confirm your reservation
          </h2>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-stone-600">
            A {formatPounds(DEPOSIT_PENNIES)} refundable deposit locks in your{" "}
            {trip.places_held} places. Once it&apos;s confirmed you have 30
            days to commit a payment plan and make the first (non-refundable)
            payment.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <form action={payDeposit}>
              <input type="hidden" name="trip_id" value={id} />
              <button className="rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                {canPayByCard
                  ? `Pay ${formatPounds(DEPOSIT_PENNIES)} deposit by card`
                  : `Arrange the ${formatPounds(DEPOSIT_PENNIES)} deposit`}
              </button>
            </form>
            <p className="text-xs text-stone-500">
              {canPayByCard
                ? "Stripe test mode — no real money moves."
                : "Bank transfer — the GSA team confirms it here."}
            </p>
          </div>
        </section>
      )}

      {/* Step 9: commit the payment plan */}
      {trip.status === "deposit_paid" && !plan && subtotal > 0 && (
        <section className="mt-8 rounded-2xl border border-warm-200/70 bg-warm-50/50 p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold tracking-tight">
            Commit your payment plan
          </h2>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-stone-600">
            Lock in how the trip gets paid. Your{" "}
            {formatPounds(trip.deposit_amount_pennies)} deposit is credited,
            and the first payment is non-refundable.
          </p>
          <form action={commitPlan} className="mt-5 space-y-5">
            <input type="hidden" name="trip_id" value={id} />

            <fieldset>
              <legend className="text-sm font-medium">When will you pay?</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col rounded-xl border border-stone-200 bg-white p-4 has-[:checked]:border-warm-400 has-[:checked]:bg-warm-50">
                  <span className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                    <input type="radio" name="choice" value="upfront" defaultChecked className="accent-warm-600" />
                    Pay upfront · save 10%
                  </span>
                  <span className="mt-1.5 pl-5 text-lg font-bold text-stone-900">
                    {formatPounds(upfrontTotal(subtotal))}
                  </span>
                </label>
                <label className="flex cursor-pointer flex-col rounded-xl border border-stone-200 bg-white p-4 has-[:checked]:border-warm-400 has-[:checked]:bg-warm-50">
                  <span className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                    <input type="radio" name="choice" value="installments" className="accent-warm-600" />
                    Monthly plan · +10%
                  </span>
                  <span className="mt-1.5 pl-5 text-lg font-bold text-stone-900">
                    {formatPounds(planTotal(subtotal))}
                  </span>
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                <label htmlFor="num_installments">Instalments (plan only):</label>
                <select
                  id="num_installments"
                  name="num_installments"
                  defaultValue="3"
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
                >
                  {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} monthly
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Who pays?</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 bg-white p-4 text-sm has-[:checked]:border-warm-400 has-[:checked]:bg-warm-50">
                  <input type="radio" name="mode" value="school_invoice" defaultChecked className="mt-0.5 accent-warm-600" />
                  <span>
                    <span className="font-semibold text-stone-900">Invoice the school</span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      One invoice to {trip.organiser_school_name ?? "your school"};
                      collect from parents however you like.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 bg-white p-4 text-sm has-[:checked]:border-warm-400 has-[:checked]:bg-warm-50">
                  <input type="radio" name="mode" value="parent_links" className="mt-0.5 accent-warm-600" />
                  <span>
                    <span className="font-semibold text-stone-900">Parent payment links</span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      Each family gets a personal link; we track who&apos;s paid.
                    </span>
                  </span>
                </label>
              </div>
              <div className="mt-3">
                <label htmlFor="parents" className="text-sm font-medium">
                  Parents (for payment links)
                </label>
                <textarea
                  id="parents"
                  name="parents"
                  rows={4}
                  placeholder={"One per line: Name, email\ne.g. Sam Taylor, sam@example.com"}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Leave empty to generate {parents ?? "—"} unnamed links you
                  can hand out later.
                </p>
              </div>
            </fieldset>

            <button className="rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
              Commit plan &amp; issue {`invoices`}
            </button>
            <p className="text-xs text-stone-500">
              The first payment is due by {formatDate(trip.cancellation_deadline)}{" "}
              and is non-refundable. Miss it and the booking is released.
            </p>
          </form>
        </section>
      )}

      {/* Committed plan + payments */}
      {plan && (
        <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Payments</h2>
              <p className="mt-1 text-sm text-stone-500">
                {plan.choice === "upfront"
                  ? "Paying upfront (10% discount applied)."
                  : `Payment plan (+10%), ${plan.num_installments} instalment${plan.num_installments > 1 ? "s" : ""}.`}{" "}
                Deposit of {formatPounds(plan.deposit_credited_pennies)} credited.
              </p>
            </div>
            <p className="text-right">
              <span className="block text-xs uppercase tracking-wider text-stone-500">
                Total committed
              </span>
              <span className="text-2xl font-bold text-stone-900">
                {formatPounds(plan.adjusted_total_pennies)}
              </span>
            </p>
          </div>

          {plan.mode === "school_invoice" && installments.length > 0 && (
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="py-2.5 font-semibold">Payment</th>
                  <th className="py-2.5 font-semibold">Due</th>
                  <th className="py-2.5 text-right font-semibold">Amount</th>
                  <th className="py-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((ins) => {
                  const overdue =
                    ins.status === "pending" &&
                    new Date(ins.due_date) < new Date();
                  return (
                    <tr key={ins.id} className="border-b border-stone-50">
                      <td className="py-3">
                        {ins.seq === 1 ? "First payment (non-refundable)" : `Payment ${ins.seq}`}
                      </td>
                      <td className="py-3 text-stone-600">{formatDate(ins.due_date)}</td>
                      <td className="py-3 text-right font-medium">
                        {formatPounds(ins.amount_pennies)}
                      </td>
                      <td className="py-3 text-right">
                        {ins.status === "paid" ? (
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                            Paid {formatDate(ins.paid_at)}
                          </span>
                        ) : ins.status === "cancelled" ? (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-500">
                            Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                overdue
                                  ? "bg-warm-100 text-warm-700"
                                  : "bg-stone-100 text-stone-600"
                              }`}
                            >
                              {overdue ? "Overdue" : "Pending"}
                            </span>
                            {canPayByCard && (
                              <form action={payInstallment} className="inline">
                                <input type="hidden" name="trip_id" value={id} />
                                <input type="hidden" name="installment_id" value={ins.id} />
                                <button className="rounded-lg bg-warm-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
                                  Pay by card
                                </button>
                              </form>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {plan.mode === "parent_links" && (
            <div className="mt-5">
              <p className="text-sm text-stone-600">
                {parentPayments.filter((p) => p.status === "paid").length} of{" "}
                {parentPayments.length} parents have paid. Share each link with
                its family — every link is private to that parent.
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-[11px] uppercase tracking-wider text-stone-500">
                    <th className="py-2.5 font-semibold">Parent</th>
                    <th className="py-2.5 text-right font-semibold">Amount</th>
                    <th className="py-2.5 text-right font-semibold">Status</th>
                    <th className="py-2.5 text-right font-semibold">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {parentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-stone-50">
                      <td className="py-3">
                        {p.parent_name}
                        {p.parent_email && (
                          <span className="block text-xs text-stone-500">
                            {p.parent_email}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatPounds(p.amount_pennies)}
                      </td>
                      <td className="py-3 text-right">
                        {p.status === "paid" ? (
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                            Paid
                          </span>
                        ) : (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                            {p.status === "cancelled" ? "Cancelled" : "Pending"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <a
                          href={`/pay/${p.token}`}
                          className="break-all text-xs text-brand-700 underline"
                        >
                          {origin}/pay/{String(p.token).slice(0, 8)}…
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoices.length > 0 && (
            <div className="mt-6 border-t border-stone-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Invoices
              </p>
              <ul className="mt-2 space-y-1.5">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-sm">
                    <Link
                      href={`/trips/${id}/invoice/${inv.id}`}
                      className="text-brand-700 underline"
                    >
                      {inv.invoice_number}
                    </Link>
                    <span className="text-stone-600">
                      {formatPounds(inv.amount_pennies)} ·{" "}
                      <span
                        className={
                          inv.status === "paid" ? "font-semibold text-brand-700" : ""
                        }
                      >
                        {inv.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Quote: the ±10% rule */}
      {!plan && subtotal > 0 && trip.status !== "cancelled" && (
        <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold tracking-tight">Ways to pay</h2>
          <p className="mt-1 text-sm text-stone-500">
            Pay upfront and save 10%, or spread the cost with a payment plan
            (+10%). Your {formatPounds(DEPOSIT_PENNIES)} deposit is credited
            either way.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Pay upfront · save 10%
              </p>
              <p className="mt-2 text-2xl font-bold text-stone-900">
                {formatPounds(upfrontTotal(subtotal))}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                vs {formatPounds(subtotal)} list price
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Payment plan · +10%
              </p>
              <p className="mt-2 text-2xl font-bold text-stone-900">
                {formatPounds(planTotal(subtotal))}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                spread over monthly instalments
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-stone-500">
            You can invoice your school for the full amount or send each parent
            their own payment link — you&apos;ll choose when committing the
            plan{trip.status === "reserved" ? " after the deposit is confirmed" : ""}.
          </p>
        </section>
      )}

      {/* Steps 6–7: parent launch pack + 1-2-1 call */}
      {trip.status !== "cancelled" && (
        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900">
              Parent launch &amp; presentation pack
            </h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-600">
              Everything you need to launch the trip with parents: the
              programme, costs per parent, and what&apos;s included.
            </p>
            <Link
              href={`/trips/${id}/pack`}
              className="mt-4 self-start rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
            >
              Open the pack
            </Link>
          </div>
          <div className="flex flex-col rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900">
              1-2-1 call &amp; parent-launch support
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              Book a call with the GSA team — we&apos;ll help you present the
              trip and answer parents&apos; questions.
            </p>
            <form action={requestLaunchCall} className="mt-4 flex gap-2">
              <input type="hidden" name="trip_id" value={id} />
              <input
                name="preferred_times"
                placeholder="Preferred times, e.g. Tue/Wed after 4pm"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs focus:border-brand-600 focus:outline-none"
              />
              <button className="shrink-0 rounded-lg border border-warm-600 px-3.5 py-2 text-xs font-semibold text-warm-700 transition-colors duration-150 hover:bg-warm-50">
                Book a call
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Cancel */}
      {["reserved", "deposit_paid", "invoiced"].includes(trip.status) && (
        <section className="mt-10 rounded-2xl border border-stone-200/70 bg-stone-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-stone-500">
              Cancelling releases your held places. The deposit is refundable
              until your first payment is made; the first payment itself is
              non-refundable.
            </p>
            <form action={cancelTrip}>
              <input type="hidden" name="trip_id" value={id} />
              <button className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 transition-colors duration-150 hover:border-warm-600 hover:text-warm-700">
                Cancel this trip
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

function Flash({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-5 rounded-xl p-4 text-sm ${
        tone === "ok" ? "bg-brand-50 text-brand-800" : "bg-warm-50 text-warm-700"
      }`}
    >
      {children}
    </div>
  );
}
