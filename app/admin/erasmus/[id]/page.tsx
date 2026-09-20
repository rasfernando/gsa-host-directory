import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CRITERIA,
  GOLDEN_THREAD,
  SECTIONS,
  THRESHOLDS,
  type Assessment,
} from "@/lib/erasmus/rubric";
import { deleteAssessment } from "../actions";

type Row = {
  id: string;
  school_name: string;
  project_title: string | null;
  status: string;
  draft: string;
  model: string | null;
  duration_ms: number | null;
  error: string | null;
  result: Assessment | null;
  created_at: string;
};

const THREAD_STYLE: Record<string, string> = {
  strong: "bg-green-50 text-green-700 border-green-200",
  weak: "bg-amber-50 text-amber-700 border-amber-200",
  missing: "bg-red-50 text-red-700 border-red-200",
};
const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

function Bar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const half = score >= max * THRESHOLDS.perCriterionFraction;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full ${half ? "bg-green-500" : "bg-red-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("erasmus_assessments")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const row = data as Row;
  const a = row.result;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/erasmus" className="text-sm text-gray-500 hover:text-gray-900">
        ← All assessments
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{row.project_title ?? "Untitled project"}</h1>
          <p className="text-sm text-gray-500">
            {row.school_name} · KA122-SCH · {new Date(row.created_at).toLocaleString("en-GB")}
            {row.model ? ` · ${row.model}` : ""}
            {row.duration_ms ? ` · ${Math.round(row.duration_ms / 1000)}s` : ""}
          </p>
        </div>
        <form action={deleteAssessment}>
          <input type="hidden" name="id" value={row.id} />
          <button className="text-xs text-gray-400 hover:text-red-600">Delete</button>
        </form>
      </div>

      {row.status === "failed" && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">The assessor could not complete this run.</p>
          <p className="mt-1 font-mono text-xs">{row.error}</p>
          <Link href="/admin/erasmus/new" className="mt-2 inline-block underline">
            Try again
          </Link>
        </div>
      )}

      {a && (
        <>
          {/* Overall */}
          <section
            className={`mt-6 rounded-xl border p-5 ${
              a.overall.pass ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-baseline gap-4">
              <p className="text-4xl font-semibold tabular-nums">
                {a.overall.score}
                <span className="text-base font-normal text-gray-500">/100</span>
              </p>
              <p
                className={`text-sm font-medium ${
                  a.overall.pass ? "text-green-700" : "text-red-700"
                }`}
              >
                {a.overall.pass
                  ? "Would pass the thresholds as written"
                  : "Would NOT pass as written"}
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Needs {THRESHOLDS.total}/100 overall and at least half marks in each criterion.
              Scores are an assessor-style estimate, not a National Agency decision.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-800">{a.overall.verdict}</p>
          </section>

          {/* Criteria */}
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            {a.criteria.map((c) => {
              const meta = CRITERIA.find((x) => x.key === c.key)!;
              return (
                <div key={c.key} className="rounded-lg border border-gray-100 bg-white p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-sm tabular-nums">
                      <span className="font-semibold">{c.score}</span>
                      <span className="text-gray-400">/{meta.max}</span>
                    </p>
                  </div>
                  <Bar score={c.score} max={meta.max} />
                  <p className="mt-3 text-xs leading-relaxed text-gray-600">{c.rationale}</p>
                  {c.weaknesses.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-red-700">
                      {c.weaknesses.map((w, i) => (
                        <li key={i}>− {w}</li>
                      ))}
                    </ul>
                  )}
                  {c.strengths.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-green-700">
                      {c.strengths.map((s, i) => (
                        <li key={i}>+ {s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>

          {/* Top actions */}
          {a.top_actions.length > 0 && (
            <section className="mt-6 rounded-lg border border-gray-900 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Do these first
              </h2>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                {a.top_actions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </section>
          )}

          {/* Golden thread */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Golden thread — need → objective → activity → measure → legacy
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {a.golden_thread.map((g) => {
                const meta = GOLDEN_THREAD.find((x) => x.key === g.key)!;
                return (
                  <li
                    key={g.key}
                    className={`rounded-lg border px-3 py-2 text-xs ${THREAD_STYLE[g.status]}`}
                  >
                    <p className="font-medium">
                      <span className="uppercase">{g.status}</span> · {meta.label}
                    </p>
                    {g.note && <p className="mt-1 opacity-90">{g.note}</p>}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Sections */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Section by section
            </h2>
            <ul className="mt-2 space-y-3">
              {a.sections.map((s) => {
                const meta = SECTIONS.find((x) => x.key === s.key)!;
                return (
                  <li key={s.key} className="rounded-lg border border-gray-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-snug">{meta.label}</p>
                      {s.present ? (
                        <span className="shrink-0 text-xs tabular-nums text-gray-500">
                          quality {s.quality}/5
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          not in draft
                        </span>
                      )}
                    </div>
                    {s.issues.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {s.issues.map((iss, i) => (
                          <li key={i} className="text-xs leading-relaxed">
                            <span
                              className={`mr-2 rounded px-1.5 py-0.5 font-medium uppercase ${SEVERITY_STYLE[iss.severity]}`}
                            >
                              {iss.severity}
                            </span>
                            <span className="text-gray-800">{iss.issue}</span>
                            {iss.quote && (
                              <p className="mt-1 border-l-2 border-gray-200 pl-2 italic text-gray-500">
                                “{iss.quote}”
                              </p>
                            )}
                            <p className="mt-1 text-gray-700">
                              <span className="font-medium">Fix:</span> {iss.fix}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.example_rewrite && (
                      <p className="mt-3 rounded bg-gray-50 p-2 text-xs leading-relaxed text-gray-700">
                        <span className="font-medium">Shape of a stronger answer:</span>{" "}
                        {s.example_rewrite}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-white p-4">
              <h2 className="text-sm font-semibold">Still needed from the school</h2>
              {a.missing_information.length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">Nothing flagged.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-700">
                  {a.missing_information.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-4">
              <h2 className="text-sm font-semibold">For the human expert to spot-check</h2>
              {a.expert_spot_checks.length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">Nothing flagged.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-700">
                  {a.expert_spot_checks.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <details className="mt-8">
        <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-900">
          Draft as submitted
        </summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-700">
          {row.draft}
        </pre>
      </details>
    </div>
  );
}
