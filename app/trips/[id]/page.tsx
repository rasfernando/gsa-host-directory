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
import { addItem, removeItem, requestLaunchCall, cancelTrip } from "../actions";

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

  const [{ data: itemsData }, { data: boltOnsData }] = await Promise.all([
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
  ]);
  const items = (itemsData ?? []) as Item[];
  const boltOns = (boltOnsData ?? []) as Product[];

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

      {/* Quote: the ±10% rule */}
      {subtotal > 0 && trip.status !== "cancelled" && (
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
