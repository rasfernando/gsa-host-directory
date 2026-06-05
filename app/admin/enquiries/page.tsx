import { createClient } from "@/lib/supabase/server";
import { updateEnquiry } from "../actions";

const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: "new", label: "New", accent: "border-t-blue-400" },
  { key: "qualified", label: "Qualified", accent: "border-t-amber-400" },
  { key: "in_progress", label: "In progress", accent: "border-t-purple-400" },
  { key: "converted", label: "Converted", accent: "border-t-green-500" },
  { key: "closed", label: "Closed", accent: "border-t-gray-300" },
];

type Enquiry = {
  id: string;
  enquirer_school_name: string;
  enquirer_name: string;
  enquirer_email: string;
  message: string;
  preferred_dates: string | null;
  group_size: number | null;
  status: string;
  gsa_notes: string | null;
  created_at: string;
  host_profiles: { name: string }[] | { name: string } | null;
};

function Card({ e }: { e: Enquiry }) {
  const host = Array.isArray(e.host_profiles) ? e.host_profiles[0] : e.host_profiles;
  const days = Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86400000);
  const stale = e.status === "new" && days > 3;
  return (
    <li className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      <p className="text-sm font-medium leading-snug">{e.enquirer_school_name}</p>
      <p className="mt-0.5 text-xs text-gray-500">→ {host?.name ?? "Unknown host"}</p>
      <p className={`mt-1 text-xs ${stale ? "font-medium text-amber-600" : "text-gray-500"}`}>
        {days === 0 ? "today" : `${days}d waiting`}
        {e.group_size ? ` · ${e.group_size} students` : ""}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
          Details
        </summary>
        <div className="mt-2 space-y-2 text-xs text-gray-700">
          <p>
            {e.enquirer_name} ·{" "}
            <a href={`mailto:${e.enquirer_email}`} className="underline">
              {e.enquirer_email}
            </a>
            {e.preferred_dates && ` · ${e.preferred_dates}`}
          </p>
          <p className="whitespace-pre-line">{e.message}</p>
          <form action={updateEnquiry} className="space-y-2 pt-1">
            <input type="hidden" name="enquiry_id" value={e.id} />
            <select
              name="status"
              defaultValue={e.status}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            >
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              name="gsa_notes"
              defaultValue={e.gsa_notes ?? ""}
              placeholder="Internal notes"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            />
            <button className="w-full rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">
              Save
            </button>
          </form>
        </div>
      </details>
      {e.gsa_notes && (
        <p className="mt-2 truncate text-xs text-gray-500" title={e.gsa_notes}>
          📝 {e.gsa_notes}
        </p>
      )}
    </li>
  );
}

export default async function AdminEnquiries() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("enquiries")
    .select(
      "id, enquirer_school_name, enquirer_name, enquirer_email, message, preferred_dates, group_size, status, gsa_notes, created_at, host_profiles(name)"
    )
    .order("created_at", { ascending: true });

  const list = (data ?? []) as Enquiry[];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Enquiries</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        {list.filter((e) => e.status === "new").length} new · {list.length} total ·
        GSA facilitates every visit — respond by email, track the pipeline here.
      </p>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          No enquiries yet. They&apos;ll appear here when schools enquire via the
          directory.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {COLUMNS.map((col) => {
            const cards = list.filter((e) => e.status === col.key);
            return (
              <div
                key={col.key}
                className={`rounded-xl border border-gray-100 border-t-4 bg-gray-50/60 p-3 ${col.accent}`}
              >
                <p className="mb-3 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {col.label}
                  <span className="rounded-full bg-white px-2 py-0.5 text-gray-500">
                    {cards.length}
                  </span>
                </p>
                <ul className="space-y-2">
                  {cards.map((e) => (
                    <Card key={e.id} e={e} />
                  ))}
                  {cards.length === 0 && (
                    <li className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
                      Empty
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
