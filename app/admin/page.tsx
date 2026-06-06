import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATION_CHECKS } from "@/lib/checklist";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  info_requested: "bg-orange-50 text-orange-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-600",
  draft: "bg-gray-100 text-gray-500",
};

function daysAgo(date: string | null) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

type AppRow = {
  id: string;
  status: string;
  submitted_at: string | null;
  schools: { name: string; country: string }[] | { name: string; country: string } | null;
  verification_checks: { status: string }[];
};

function Row({ app }: { app: AppRow }) {
  const school = Array.isArray(app.schools) ? app.schools[0] : app.schools;
  const done = (app.verification_checks ?? []).filter(
    (c) => c.status !== "pending"
  ).length;
  const days = daysAgo(app.submitted_at);
  const active = ["submitted", "under_review"].includes(app.status);
  return (
    <li>
      <Link
        href={`/admin/applications/${app.id}`}
        className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
      >
        <div>
          <p className="text-sm font-medium">{school?.name ?? "Unknown school"}</p>
          <p className="text-xs text-gray-500">
            {school?.country}
            {days != null && (
              <>
                {" · "}
                <span className={active && days > 7 ? "font-medium text-amber-600" : ""}>
                  submitted {days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {done}/{VERIFICATION_CHECKS.length} checks
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[app.status] ?? ""}`}
          >
            {app.status.replace("_", " ")}
          </span>
        </div>
      </Link>
    </li>
  );
}

export default async function AdminQueue() {
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("host_applications")
    .select(
      "id, status, submitted_at, schools(name, country), verification_checks(status)"
    )
    .order("submitted_at", { ascending: true, nullsFirst: false });

  const all = (applications ?? []) as AppRow[];
  const needsReview = all.filter((a) =>
    ["submitted", "under_review", "info_requested", "draft"].includes(a.status)
  );
  const decided = all
    .filter((a) => ["approved", "rejected"].includes(a.status))
    .reverse();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Accreditation review queue
      </h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">
        {needsReview.length} awaiting review · oldest first
      </p>

      {needsReview.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          Nothing waiting — new accreditation applications appear here.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {needsReview.map((app) => (
            <Row key={app.id} app={app} />
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Decided ({decided.length})
          </h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {decided.map((app) => (
              <Row key={app.id} app={app} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
