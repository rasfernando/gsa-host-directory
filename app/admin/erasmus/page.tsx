import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { THRESHOLDS } from "@/lib/erasmus/rubric";

type Row = {
  id: string;
  school_name: string;
  project_title: string | null;
  status: string;
  created_at: string;
  result: { overall?: { score: number; pass: boolean } } | null;
};

export default async function ErasmusIndex() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("erasmus_assessments")
    .select("id, school_name, project_title, status, created_at, result")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Erasmus+ application assessor</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Paste a school&apos;s draft KA122-SCH application (or one section). It is scored
            the way a National Agency assessor would — Relevance /20, Project design /50,
            Follow-up /30, pass at {THRESHOLDS.total} with half marks in each — and
            checked against GSA&apos;s golden thread: need → objective → activity → measure →
            legacy. Proof of concept: try to break it.
          </p>
        </div>
        <Link
          href="/admin/erasmus/new"
          className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          New assessment
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
          No assessments yet.{" "}
          <Link href="/admin/erasmus/new?example=strong" className="underline">
            Run the worked example
          </Link>{" "}
          to see what a strong draft looks like.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
          {rows.map((r) => {
            const score = r.result?.overall?.score;
            const pass = r.result?.overall?.pass;
            return (
              <li key={r.id}>
                <Link
                  href={`/admin/erasmus/${r.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.project_title ?? "Untitled project"}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {r.school_name} · {new Date(r.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {r.status === "complete" && typeof score === "number" ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          pass ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {score}/100 · {pass ? "would pass" : "would not pass"}
                      </span>
                    ) : r.status === "failed" ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        failed
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">pending</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
