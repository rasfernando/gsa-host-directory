import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPounds } from "@/lib/money";
import { saveProduct, addSupplier } from "../trips/actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-gray-500 focus:outline-none";

const PRODUCT_TYPES = ["immersion_camp", "flight", "attraction", "accommodation", "other"];
const TIERS = ["", "standard", "premium", "budget", "quality"];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const flags = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/products");

  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase
      .from("products")
      .select("*, suppliers(name)")
      .order("type")
      .order("name"),
    supabase.from("suppliers").select("*").order("name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Products &amp; suppliers</h1>
      <p className="mt-1 text-sm text-gray-500">
        The catalogue organisers build baskets from. Prices here are the only
        prices the platform will charge — basket lines always inherit them.
      </p>

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

      <div className="mt-6 space-y-3">
        {(products ?? []).map((p) => {
          const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
          return (
            <details key={p.id} className="rounded-xl border border-gray-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm">
                <span>
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {supplier?.name} · {p.type}
                    {p.tier ? ` · ${p.tier}` : ""}
                    {p.bolt_on ? " · bolt-on" : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{formatPounds(p.unit_price_pennies)}</span>
                  {!p.active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                      inactive
                    </span>
                  )}
                </span>
              </summary>
              <form
                action={saveProduct}
                className="flex flex-wrap items-end gap-3 border-t border-gray-100 px-5 py-4"
              >
                <input type="hidden" name="product_id" value={p.id} />
                <label className="text-xs text-gray-600">
                  Name
                  <input name="name" defaultValue={p.name} required className={`${inputCls} mt-1 block w-64`} />
                </label>
                <label className="text-xs text-gray-600">
                  Supplier
                  <select name="supplier_id" defaultValue={p.supplier_id} className={`${inputCls} mt-1 block`}>
                    {(suppliers ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Type
                  <select name="type" defaultValue={p.type} className={`${inputCls} mt-1 block`}>
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Tier
                  <select name="tier" defaultValue={p.tier ?? ""} className={`${inputCls} mt-1 block`}>
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t || "—"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Price £
                  <input
                    name="unit_price_pounds"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={(p.unit_price_pennies / 100).toFixed(2)}
                    className={`${inputCls} mt-1 block w-28`}
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Pricing
                  <select name="pricing_unit" defaultValue={p.pricing_unit} className={`${inputCls} mt-1 block`}>
                    <option value="per_place">per place</option>
                    <option value="per_group">per group</option>
                    <option value="flat">flat</option>
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Commission %
                  <input
                    name="commission_pct"
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    defaultValue={(p.commission_bps / 100).toString()}
                    className={`${inputCls} mt-1 block w-20`}
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Settlement
                  <select name="default_route" defaultValue={p.default_route} className={`${inputCls} mt-1 block`}>
                    <option value="pay_direct">pay supplier direct</option>
                    <option value="passthrough">same-day passthrough</option>
                    <option value="gsa">GSA plan</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" name="bolt_on" defaultChecked={p.bolt_on} /> bolt-on
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" name="active" defaultChecked={p.active} /> active
                </label>
                <label className="w-full text-xs text-gray-600">
                  Description
                  <input name="description" defaultValue={p.description ?? ""} className={`${inputCls} mt-1 block w-full`} />
                </label>
                <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                  Save changes
                </button>
              </form>
            </details>
          );
        })}
      </div>

      {/* New product */}
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Add a product</h2>
        <form action={saveProduct} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600">
            Name
            <input name="name" required className={`${inputCls} mt-1 block w-64`} />
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
            Type
            <select name="type" className={`${inputCls} mt-1 block`}>
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Tier
            <select name="tier" className={`${inputCls} mt-1 block`}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t || "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Price £
            <input name="unit_price_pounds" type="number" step="0.01" min="0" required className={`${inputCls} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-gray-600">
            Commission %
            <input name="commission_pct" type="number" step="0.5" min="0" max="50" defaultValue="0" className={`${inputCls} mt-1 block w-20`} />
          </label>
          <label className="text-xs text-gray-600">
            Settlement
            <select name="default_route" className={`${inputCls} mt-1 block`}>
              <option value="pay_direct">pay supplier direct</option>
              <option value="passthrough">same-day passthrough</option>
              <option value="gsa">GSA plan</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" name="bolt_on" /> bolt-on
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" name="active" defaultChecked /> active
          </label>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Add product
          </button>
        </form>
      </section>

      {/* Suppliers */}
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Suppliers</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {(suppliers ?? []).map((s) => (
            <li key={s.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
              {s.name} · {s.type}
            </li>
          ))}
        </ul>
        <form action={addSupplier} className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
          <label className="text-xs text-gray-600">
            Name
            <input name="name" required className={`${inputCls} mt-1 block`} />
          </label>
          <label className="text-xs text-gray-600">
            Type
            <select name="type" className={`${inputCls} mt-1 block`}>
              {["gsa", "flights", "attractions", "accommodation", "other"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Contact email
            <input name="contact_email" type="email" className={`${inputCls} mt-1 block w-56`} />
          </label>
          <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Add supplier
          </button>
        </form>
      </section>
    </div>
  );
}
