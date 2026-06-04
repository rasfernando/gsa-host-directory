import { createClient } from "@/lib/supabase/server";
import { updateEnquiry } from "../actions";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  qualified: "bg-amber-50 text-amber-700",
  in_progress: "bg-purple-50 text-purple-700",
  converted: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

export default async function AdminEnquiries() {
  const supabase = await createClient();

  const { data: enquiries } = await supabase
    .from("enquiries")
    .select(
      "id, enquirer_school_name, enquirer_name, enquirer_email, message, preferred_dates, group_size, status, gsa_notes, created_at, host_profiles(name)"
    )
    .order("created_at", { ascending: false });

  const list = enquiries ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Enquiries</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        {list.filter((e) => e.status === "new").length} new · {list.length} total.
        GSA facilitates every visit — respond directly by email, track status here.
      </p>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          No enquiries yet. They&apos;ll appear here when schools enquire via the
          directory.
        </p>
      ) : (
        <ul className="space-y-4">
          {list.map((e) => {
            const host = Array.isArray(e.host_profiles)
              ? e.host_profiles[0]
              : e.host_profiles;
            return (
              <li key={e.id} className="rounded-xl border border-gray-100 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {e.enquirer_school_name} → {host?.name ?? "Unknown host"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {e.enquirer_name} ·{" "}
                      <a href={`mailto:${e.enquirer_email}`} className="underline">
                        {e.enquirer_email}
                      </a>
                      {e.preferred_dates && ` · ${e.preferred_dates}`}
                      {e.group_size && ` · group of ${e.group_size}`}
                      {" · "}
                      {new Date(e.created_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[e.status] ?? ""}`}
                  >
                    {e.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{e.message}</p>
                <form action={updateEnquiry} className="mt-4 flex items-center gap-2">
                  <input type="hidden" name="enquiry_id" value={e.id} />
                  <select
                    name="status"
                    defaultValue={e.status}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    <option value="new">new</option>
                    <option value="qualified">qualified</option>
                    <option value="in_progress">in progress</option>
                    <option value="converted">converted</option>
                    <option value="closed">closed</option>
                  </select>
                  <input
                    name="gsa_notes"
                    defaultValue={e.gsa_notes ?? ""}
                    placeholder="Internal notes"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
                  />
                  <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">
                    Save
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
