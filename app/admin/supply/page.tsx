import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, daysUntil } from "@/lib/trips";
import {
  createCohort,
  setCohortStatus,
  createIntakeInvite,
  staffCreateSchool,
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

  const [{ data: cohorts }, { data: invites }, { count: listedCount }] =
    await Promise.all([
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
    </div>
  );
}
