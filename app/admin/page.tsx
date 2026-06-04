import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-600",
  draft: "bg-gray-100 text-gray-500",
};

export default async function AdminQueue() {
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("host_applications")
    .select("id, status, submitted_at, created_at, schools(name, country)")
    .order("submitted_at", { ascending: true, nullsFirst: false });

  const queue = applications ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        {queue.filter((a) => ["submitted", "under_review"].includes(a.status)).length}{" "}
        awaiting review · {queue.length} total
      </p>

      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          No applications yet. They&apos;ll appear here as schools apply.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {queue.map((app) => {
            // Supabase typing returns joined rows as an array; take the first
            const school = Array.isArray(app.schools) ? app.schools[0] : app.schools;
            return (
              <li key={app.id}>
                <Link
                  href={`/admin/applications/${app.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium">{school?.name ?? "Unknown school"}</p>
                    <p className="text-xs text-gray-400">
                      {school?.country} ·{" "}
                      {app.submitted_at
                        ? `submitted ${new Date(app.submitted_at).toLocaleDateString("en-GB")}`
                        : "draft"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[app.status] ?? ""}`}
                  >
                    {app.status.replace("_", " ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
