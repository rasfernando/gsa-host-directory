import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATION_CHECKS } from "@/lib/checklist";
import { recordCheck, approveApplication, rejectApplication } from "../../actions";

const CHECK_BADGES: Record<string, string> = {
  passed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-600",
  waived: "bg-gray-100 text-gray-500",
  pending: "bg-amber-50 text-amber-700",
};

export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("host_applications")
    .select(
      "id, status, answers, submitted_at, decision_notes, schools(name, country, city, website, contact_name, contact_email)"
    )
    .eq("id", id)
    .single();

  if (!app) notFound();

  const { data: checks } = await supabase
    .from("verification_checks")
    .select("check_key, status, notes, checked_at")
    .eq("application_id", id);

  const checkMap = new Map((checks ?? []).map((c) => [c.check_key, c]));
  const school = Array.isArray(app.schools) ? app.schools[0] : app.schools;
  const answers = (app.answers ?? {}) as Record<string, unknown>;
  const decided = ["approved", "rejected"].includes(app.status);
  const allPassed = VERIFICATION_CHECKS.every((c) =>
    ["passed", "waived"].includes(checkMap.get(c.key)?.status ?? "")
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-900">
        ← Review queue
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{school?.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {school?.city ? `${school.city}, ` : ""}
            {school?.country} · {school?.contact_name} ({school?.contact_email})
            {school?.website && (
              <>
                {" · "}
                <a href={school.website} className="underline" target="_blank">
                  website
                </a>
              </>
            )}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
          {app.status.replace("_", " ")}
        </span>
      </div>

      {/* Application answers */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Application
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-gray-100 p-5 text-sm">
          {Object.entries(answers).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                {key.replace(/_/g, " ")}
              </dt>
              <dd className="mt-0.5 text-gray-800">
                {Array.isArray(value)
                  ? value.join(", ") || "—"
                  : typeof value === "boolean"
                    ? value ? "Yes" : "No"
                    : String(value ?? "—") || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Verification checklist */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Verification checklist
        </h2>
        <ul className="mt-3 space-y-3">
          {VERIFICATION_CHECKS.map((check) => {
            const result = checkMap.get(check.key);
            const status = result?.status ?? "pending";
            return (
              <li key={check.key} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-xs text-gray-400">{check.description}</p>
                    {result?.notes && (
                      <p className="mt-1 text-xs text-gray-600">Note: {result.notes}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CHECK_BADGES[status]}`}>
                    {status}
                  </span>
                </div>
                {!decided && (
                  <form action={recordCheck} className="mt-3 flex items-center gap-2">
                    <input type="hidden" name="application_id" value={app.id} />
                    <input type="hidden" name="check_key" value={check.key} />
                    <select
                      name="status"
                      defaultValue={status}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      <option value="pending">pending</option>
                      <option value="passed">passed</option>
                      <option value="failed">failed</option>
                      <option value="waived">waived</option>
                    </select>
                    <input
                      name="notes"
                      defaultValue={result?.notes ?? ""}
                      placeholder="Notes (what was checked, when, by whom)"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
                    />
                    <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">
                      Save
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Decision */}
      {!decided && (
        <section className="mt-8 rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Decision
          </h2>
          {!allPassed && (
            <p className="mt-2 text-xs text-amber-600">
              All checks must be passed or waived before approval.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <form action={approveApplication}>
              <input type="hidden" name="application_id" value={app.id} />
              <input
                name="decision_notes"
                placeholder="Approval notes (optional)"
                className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
              />
              <button
                disabled={!allPassed}
                className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Approve & accredit
              </button>
            </form>
            <form action={rejectApplication}>
              <input type="hidden" name="application_id" value={app.id} />
              <input
                name="decision_notes"
                placeholder="Reason (shared with school)"
                className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
              />
              <button className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                Reject
              </button>
            </form>
          </div>
        </section>
      )}

      {decided && app.decision_notes && (
        <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          Decision notes: {app.decision_notes}
        </p>
      )}
    </div>
  );
}
