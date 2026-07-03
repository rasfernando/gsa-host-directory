import { createClient } from "@/lib/supabase/server";
import { CREDIT_REASON_LABELS } from "@/lib/credits";
import { adjustCredits, updateCreditValue } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  noschool: "Pick a school to adjust.",
  amount: "Enter a non-zero whole number.",
  note: "A note is required — it shows in the school's history.",
  badkey: "Unknown credit setting.",
};

const VALUE_SETTINGS: { key: string; label: string }[] = [
  { key: "credits_profile_verified", label: "Profile verified" },
  { key: "credits_booking", label: "Trip booked" },
  { key: "credits_hosting", label: "Hosted a group" },
  { key: "credits_referral", label: "Referred a school" },
];

export default async function AdminCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient();

  const [{ data: ledger }, { data: schools }, { data: settings }] =
    await Promise.all([
      supabase
        .from("credit_ledger")
        .select("id, school_id, delta, reason, note, created_at, schools(name)")
        .order("created_at", { ascending: false }),
      supabase.from("schools").select("id, name").order("name"),
      supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "credits_%"),
    ]);

  type Row = {
    id: string;
    school_id: string;
    delta: number;
    reason: string;
    note: string | null;
    created_at: string;
    schools: { name: string } | { name: string }[] | null;
  };
  const rows = (ledger ?? []) as Row[];
  const schoolName = (r: Row) =>
    (Array.isArray(r.schools) ? r.schools[0]?.name : r.schools?.name) ?? "—";

  // Balances per school, from the ledger itself.
  const balances = new Map<string, { name: string; balance: number; count: number }>();
  for (const r of rows) {
    const cur = balances.get(r.school_id) ?? {
      name: schoolName(r),
      balance: 0,
      count: 0,
    };
    cur.balance += r.delta;
    cur.count += 1;
    balances.set(r.school_id, cur);
  }
  const ranked = [...balances.entries()].sort((a, b) => b[1].balance - a[1].balance);
  const values = new Map((settings ?? []).map((s) => [s.key, s.value]));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every school&apos;s GSA credits. Awards happen automatically (verification,
        bookings, hosting); use the adjustment form for referrals or corrections —
        the note is visible to the school.
      </p>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {saved === "values" ? "Credit values updated." : "Adjustment recorded."}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {ERRORS[error] ?? error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Balances */}
        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">Balances</h2>
          {ranked.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No credits awarded yet. They&apos;ll appear as schools get verified,
              book and host.
            </p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">School</th>
                  <th className="py-2 pr-4 text-right">Credits</th>
                  <th className="py-2 text-right">Entries</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(([id, s]) => (
                  <tr key={id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{s.name}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{s.balance}</td>
                    <td className="py-2 text-right text-gray-500">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="mt-8 text-sm font-semibold text-gray-900">Recent activity</h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">School</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4 text-right">Credits</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 whitespace-nowrap text-gray-500">
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="py-2 pr-4">{schoolName(r)}</td>
                  <td className="py-2 pr-4">
                    {CREDIT_REASON_LABELS[r.reason] ?? r.reason}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${r.delta < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {r.delta > 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className="py-2 text-gray-500">{r.note ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-gray-400">
                    Nothing yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Adjust + values */}
        <section className="space-y-6">
          <form
            action={adjustCredits}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-gray-900">Adjust credits</h2>
            <label className="mt-3 block text-xs font-medium text-gray-600" htmlFor="school_id">
              School
            </label>
            <select
              id="school_id"
              name="school_id"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Choose a school…</option>
              {(schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-xs font-medium text-gray-600" htmlFor="delta">
              Credits (use a negative number to remove)
            </label>
            <input
              id="delta"
              name="delta"
              type="number"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. 25 or -25"
            />
            <label className="mt-3 block text-xs font-medium text-gray-600" htmlFor="note">
              Note (shown to the school)
            </label>
            <input
              id="note"
              name="note"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. Referred Maple Grove Primary"
            />
            <button className="mt-4 w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700">
              Record adjustment
            </button>
          </form>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Credit values</h2>
            <p className="mt-1 text-xs text-gray-500">
              How many credits each action earns. Applies to future awards only.
            </p>
            {VALUE_SETTINGS.map((v) => (
              <form
                key={v.key}
                action={updateCreditValue}
                className="mt-3 flex items-center gap-2"
              >
                <input type="hidden" name="key" value={v.key} />
                <span className="flex-1 text-sm text-gray-700">{v.label}</span>
                <input
                  name="value"
                  type="number"
                  min={0}
                  defaultValue={values.get(v.key) ?? "0"}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm"
                />
                <button className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  Save
                </button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
