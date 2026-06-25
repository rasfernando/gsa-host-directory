import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, daysUntil } from "@/lib/trips";
import { formatPounds } from "@/lib/money";
import {
  createCohort,
  setCohortStatus,
  createIntakeInvite,
  staffCreateSchool,
  createAgent,
  setAgentStatus,
  markCommissionPaid,
  createBlockBooking,
  releaseBlockBooking,
} from "./actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-gray-500 focus:outline-none";

const TEMPLATE_LABELS: Record<string, string> = {
  gcc: "Global Citizen Camp",
  standard: "Standard immersive trip",
  other: "Other",
};

export default async function AdminSupplyPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const flags = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/supply");

  const [
    { data: cohorts },
    { data: invites },
    { count: listedCount },
    { data: needContact },
    { data: agents },
    { data: commissions },
    { data: blocks },
    { data: hostOptions },
  ] = await Promise.all([
    supabase
      .from("verification_cohorts")
      .select("*, host_applications(id, status)")
      .order("evidence_deadline", { ascending: true }),
    supabase
      .from("intake_invites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("host_profiles")
      .select("id", { count: "exact", head: true })
      .eq("tier", "listed"),
    supabase
      .from("schools")
      .select("id, name, country, city")
      .is("contact_email", null)
      .order("name"),
    supabase.from("agents").select("*").order("created_at"),
    supabase
      .from("agent_commissions")
      .select("*, agents(agency_name), trips(organiser_school_name)")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("block_bookings")
      .select("*, agents(agency_name), host_profiles(name)")
      .order("window_start"),
    supabase
      .from("host_profiles")
      .select("id, name")
      .eq("published", true)
      .order("name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Supply</h1>
      <p className="mt-1 text-sm text-gray-500">
        Verification cohorts, GSA-led onboarding, and direct school creation.
        {typeof listedCount === "number" &&
          ` ${listedCount} listed school${listedCount === 1 ? "" : "s"} not yet verified.`}
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

      {/* Cohorts */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Verification cohorts
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Verification runs in tranches: schools get an evidence window to make
          the next cohort; checks are batched after the deadline.
        </p>

        <ul className="mt-3 space-y-2">
          {(cohorts ?? []).map((c) => {
            const apps = (c.host_applications ?? []) as { status: string }[];
            const days = daysUntil(c.evidence_deadline);
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    evidence by {formatDate(c.evidence_deadline)}
                    {c.status === "open" && days != null && days >= 0
                      ? ` (${days}d left)`
                      : ""}
                    {c.decision_by ? ` · decisions by ${formatDate(c.decision_by)}` : ""}
                    {` · ${apps.length} application${apps.length === 1 ? "" : "s"}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      c.status === "open"
                        ? "bg-emerald-50 text-emerald-700"
                        : c.status === "closed"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.status !== "decided" && (
                    <form action={setCohortStatus}>
                      <input type="hidden" name="cohort_id" value={c.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={c.status === "open" ? "closed" : "decided"}
                      />
                      <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-500">
                        {c.status === "open" ? "Close window" : "Mark decided"}
                      </button>
                    </form>
                  )}
                </span>
              </li>
            );
          })}
          {(cohorts ?? []).length === 0 && (
            <li className="text-sm text-gray-500">No cohorts yet.</li>
          )}
        </ul>

        <form
          action={createCohort}
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4"
        >
          <label className="text-xs text-gray-600">
            Name
            <input
              name="name"
              required
              placeholder="e.g. Autumn 2026 cohort"
              className={`${inputCls} mt-1 block w-52`}
            />
          </label>
          <label className="text-xs text-gray-600">
            Evidence deadline
            <input name="evidence_deadline" type="date" required className={`${inputCls} mt-1 block`} />
          </label>
          <label className="text-xs text-gray-600">
            Decisions by
            <input name="decision_by" type="date" className={`${inputCls} mt-1 block`} />
          </label>
          <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Open cohort
          </button>
        </form>
      </section>

      {/* Schools imported without a contact email — Heather to chase */}
      {(needContact ?? []).length > 0 && (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Schools awaiting a contact ({(needContact ?? []).length})
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Imported (AIP) or created without an email — chase a contact, then
            send them an intake invite below.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {(needContact ?? []).map((s) => (
              <li key={s.id} className="rounded-full bg-white px-3 py-1 text-xs text-gray-600 ring-1 ring-amber-200">
                {s.name}
                <span className="text-gray-400">
                  {s.city ? ` · ${s.city}` : ""}{s.country ? ` · ${s.country}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Staff-create school */}
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Create a school directly
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          For AIP schools and known upcoming trips: GSA does the skeleton, the
          school fleshes it out. Stays unpublished until verified.
        </p>
        <form action={staffCreateSchool} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            School name
            <input name="name" required className={`${inputCls} mt-1 block w-56`} />
          </label>
          <label className="text-xs text-gray-600">
            Country
            <input name="country" required className={`${inputCls} mt-1 block w-36`} />
          </label>
          <label className="text-xs text-gray-600">
            City
            <input name="city" className={`${inputCls} mt-1 block w-32`} />
          </label>
          <label className="text-xs text-gray-600">
            Contact name
            <input name="contact_name" className={`${inputCls} mt-1 block w-40`} />
          </label>
          <label className="text-xs text-gray-600">
            Contact email
            <input name="contact_email" type="email" className={`${inputCls} mt-1 block w-52`} />
          </label>
          <label className="text-xs text-gray-600">
            Intake template
            <select name="template" className={`${inputCls} mt-1 block`}>
              <option value="gcc">Global Citizen Camp</option>
              <option value="standard">Standard immersive trip</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-600">
            <input type="checkbox" name="send_invite" defaultChecked /> email them
            an invite link
          </label>
          <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Create school
          </button>
        </form>
      </section>

      {/* Intake invites */}
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          GSA intake invites
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Private &quot;GSA invited you&quot; links with product-specific
          templates — these bypass the public register form.
        </p>

        <form action={createIntakeInvite} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            School name
            <input name="school_name" required className={`${inputCls} mt-1 block w-56`} />
          </label>
          <label className="text-xs text-gray-600">
            Template
            <select name="template" className={`${inputCls} mt-1 block`}>
              <option value="gcc">Global Citizen Camp</option>
              <option value="standard">Standard immersive trip</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Country
            <input name="country" className={`${inputCls} mt-1 block w-32`} />
          </label>
          <label className="text-xs text-gray-600">
            Contact name
            <input name="contact_name" className={`${inputCls} mt-1 block w-36`} />
          </label>
          <label className="text-xs text-gray-600">
            Contact email
            <input name="contact_email" type="email" className={`${inputCls} mt-1 block w-52`} />
          </label>
          <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Create invite
          </button>
        </form>

        <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
          {(invites ?? []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium text-gray-900">{i.school_name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {TEMPLATE_LABELS[i.template] ?? i.template}
                  {i.country ? ` · ${i.country}` : ""}
                  {i.contact_email ? ` · ${i.contact_email}` : ""}
                </span>
              </span>
              {i.used_at ? (
                <span className="text-xs font-semibold text-emerald-700">
                  used {formatDate(i.used_at)}
                </span>
              ) : (
                <a
                  href={`/onboard/${i.token}`}
                  className="text-xs text-gray-500 underline hover:text-gray-900"
                >
                  /onboard/{String(i.token).slice(0, 8)}…
                </a>
              )}
            </li>
          ))}
          {(invites ?? []).length === 0 && (
            <li className="text-sm text-gray-500">No invites yet.</li>
          )}
        </ul>
      </section>

      {/* Agents */}
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Agents &amp; resellers</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Commission resale: agents build trips for their client schools and
          earn on the GSA programme. They must sign in once before being added.
        </p>

        <form action={createAgent} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            Account email
            <input name="email" type="email" required className={`${inputCls} mt-1 block w-56`} />
          </label>
          <label className="text-xs text-gray-600">
            Agency name
            <input name="agency_name" required className={`${inputCls} mt-1 block w-48`} />
          </label>
          <label className="text-xs text-gray-600">
            Country
            <input name="country" className={`${inputCls} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-gray-600">
            Commission %
            <input name="commission_pct" type="number" step="0.5" min="0" max="50" defaultValue="10" className={`${inputCls} mt-1 block w-20`} />
          </label>
          <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Add agent
          </button>
        </form>

        <ul className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          {(agents ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium text-gray-900">{a.agency_name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {a.contact_email} · {(a.commission_bps / 100).toFixed(1)}%
                  {a.country ? ` · ${a.country}` : ""}
                </span>
              </span>
              <form action={setAgentStatus} className="flex items-center gap-2">
                <input type="hidden" name="agent_id" value={a.id} />
                <input
                  type="hidden"
                  name="status"
                  value={a.status === "active" ? "suspended" : "active"}
                />
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    a.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {a.status}
                </span>
                <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-500">
                  {a.status === "active" ? "Suspend" : "Reactivate"}
                </button>
              </form>
            </li>
          ))}
          {(agents ?? []).length === 0 && (
            <li className="text-sm text-gray-500">No agents yet.</li>
          )}
        </ul>

        {(commissions ?? []).length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Commissions
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(commissions ?? []).map((c) => {
                const agent = Array.isArray(c.agents) ? c.agents[0] : c.agents;
                const trip = Array.isArray(c.trips) ? c.trips[0] : c.trips;
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {agent?.agency_name} · {trip?.organiser_school_name ?? "trip"} ·{" "}
                      <strong>{formatPounds(c.amount_pennies)}</strong>
                      <span className="ml-2 text-xs text-gray-500">{c.status}</span>
                    </span>
                    {c.status === "payable" && (
                      <form action={markCommissionPaid}>
                        <input type="hidden" name="commission_id" value={c.id} />
                        <button className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700">
                          Mark paid
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Block bookings */}
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Block-booked allocations
          </p>
          <form action={createBlockBooking} className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-600">
              Agent
              <select name="agent_id" required className={`${inputCls} mt-1 block`}>
                {(agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.agency_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Host school
              <select name="host_profile_id" required className={`${inputCls} mt-1 block`}>
                {(hostOptions ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              From
              <input name="window_start" type="date" required className={`${inputCls} mt-1 block`} />
            </label>
            <label className="text-xs text-gray-600">
              To
              <input name="window_end" type="date" required className={`${inputCls} mt-1 block`} />
            </label>
            <label className="text-xs text-gray-600">
              Places
              <input name="places" type="number" min={1} max={500} defaultValue={20} className={`${inputCls} mt-1 block w-20`} />
            </label>
            <button className="rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-700">
              Lock allocation
            </button>
          </form>
          <ul className="mt-3 space-y-1.5 text-sm">
            {(blocks ?? []).map((b) => {
              const agent = Array.isArray(b.agents) ? b.agents[0] : b.agents;
              const host = Array.isArray(b.host_profiles) ? b.host_profiles[0] : b.host_profiles;
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {agent?.agency_name} → {host?.name} ·{" "}
                    {formatDate(b.window_start)} – {formatDate(b.window_end)} ·{" "}
                    {b.places} places
                    <span className="ml-2 text-xs text-gray-500">{b.status}</span>
                  </span>
                  {b.status === "active" && (
                    <form action={releaseBlockBooking}>
                      <input type="hidden" name="block_id" value={b.id} />
                      <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-gray-500">
                        Release
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
            {(blocks ?? []).length === 0 && (
              <li className="text-sm text-gray-500">No allocations.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
