import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_AREAS, inputCls, labelCls } from "@/lib/forms";
import { updateApplication, addEvidence, removeEvidence } from "../actions";

export const dynamic = "force-dynamic";

type EvidenceFile = { name: string; path: string };

const sectionHeadingCls =
  "text-xs font-semibold uppercase tracking-widest text-brand-700";

const DOC_ERRORS: Record<string, string> = {
  nofile: "Please choose a document to upload.",
  toobig: "That file is over 10 MB — please upload a smaller one.",
};

export default async function EditApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    responded?: string;
    error?: string;
  }>;
}) {
  const { saved, responded, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/your-school/application");

  const { data: up } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();
  if (!up?.school_id) redirect("/your-school");

  const { data: app } = await supabase
    .from("host_applications")
    .select("id, status, answers, info_request, evidence_files")
    .eq("school_id", up.school_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Only editable before a decision.
  if (
    !app ||
    !["draft", "submitted", "under_review", "info_requested"].includes(app.status)
  ) {
    redirect("/your-school");
  }

  const a = (app.answers ?? {}) as Record<string, unknown>;
  const str = (k: string) => (a[k] as string) ?? "";
  const arr = (k: string) => ((a[k] as string[]) ?? []).join(", ");
  const focus = (a.focus_areas as string[]) ?? [];
  const responding = app.status === "info_requested";
  const evidence = (app.evidence_files as EvidenceFile[] | null) ?? [];

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/your-school" className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900">
        ← Your school
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        Edit your application
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">
        You can update any answer until the GSA team makes a decision. They
        review the latest version.
      </p>

      {responding && app.info_request && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            The GSA team asked for:
          </p>
          <p className="mt-1 text-sm text-amber-900">“{app.info_request}”</p>
          <p className="mt-2 text-xs text-amber-700">
            Update your answers and attach any documents below, then send it
            back for review.
          </p>
        </div>
      )}

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Application updated.
        </p>
      )}
      {responded && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Sent back to the GSA team — they&apos;ll pick it up from here.
        </p>
      )}
      {error && DOC_ERRORS[error] && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {DOC_ERRORS[error]}
        </p>
      )}

      <form action={updateApplication} className="mt-8 space-y-6">
        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>Your role</h2>
          <div>
            <label className={labelCls} htmlFor="role_at_school">Your role</label>
            <input className={inputCls} id="role_at_school" name="role_at_school" required defaultValue={str("role_at_school")} placeholder="e.g. Headteacher" />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>Hosting capability</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="age_range_min">Ages from</label>
              <input className={inputCls} id="age_range_min" name="age_range_min" type="number" min={3} max={19} required defaultValue={(a.age_range_min as number) ?? ""} />
            </div>
            <div>
              <label className={labelCls} htmlFor="age_range_max">Ages to</label>
              <input className={inputCls} id="age_range_max" name="age_range_max" type="number" min={3} max={19} required defaultValue={(a.age_range_max as number) ?? ""} />
            </div>
            <div>
              <label className={labelCls} htmlFor="capacity">Max group size</label>
              <input className={inputCls} id="capacity" name="capacity" type="number" min={1} required defaultValue={(a.capacity as number) ?? ""} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="languages">Languages (comma-separated)</label>
            <input className={inputCls} id="languages" name="languages" required defaultValue={arr("languages")} />
          </div>
          <div>
            <label className={labelCls} htmlFor="subject_strengths">Subject strengths (comma-separated)</label>
            <input className={inputCls} id="subject_strengths" name="subject_strengths" defaultValue={arr("subject_strengths")} />
          </div>
          <fieldset>
            <legend className={labelCls}>Focus areas</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FOCUS_AREAS.map((area) => (
                <label key={area} className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="focus_areas" value={area} defaultChecked={focus.includes(area)} className="rounded border-stone-300" />
                  {area}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="boarding" defaultChecked={Boolean(a.boarding)} className="rounded border-stone-300" />
              Boarding available
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="homestay" defaultChecked={Boolean(a.homestay)} className="rounded border-stone-300" />
              Homestay available
            </label>
          </div>
          <div>
            <label className={labelCls} htmlFor="typical_hosting_windows">When can you typically host?</label>
            <input className={inputCls} id="typical_hosting_windows" name="typical_hosting_windows" defaultValue={str("typical_hosting_windows")} />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>Safeguarding</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_name">Designated safeguarding lead</label>
              <input className={inputCls} id="safeguarding_lead_name" name="safeguarding_lead_name" required defaultValue={str("safeguarding_lead_name")} />
            </div>
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_email">Their email</label>
              <input className={inputCls} id="safeguarding_lead_email" name="safeguarding_lead_email" type="email" required defaultValue={str("safeguarding_lead_email")} />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>About your hosting</h2>
          <div>
            <label className={labelCls} htmlFor="hosting_experience">Previous hosting / exchange experience</label>
            <textarea className={inputCls} id="hosting_experience" name="hosting_experience" rows={3} defaultValue={str("hosting_experience")} />
          </div>
          <div>
            <label className={labelCls} htmlFor="why_host">Why does your school want to host?</label>
            <textarea className={inputCls} id="why_host" name="why_host" rows={3} required defaultValue={str("why_host")} />
          </div>
        </section>

        <button className="w-full rounded-lg bg-warm-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
          {responding ? "Send updated application back to GSA" : "Save changes"}
        </button>
      </form>

      {/* Supporting documents */}
      <section className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className={sectionHeadingCls}>Supporting documents</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Attach any documents the GSA team has asked for — for example your
          safeguarding policy. These are private to GSA.
        </p>

        {evidence.length > 0 && (
          <ul className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200/70">
            {evidence.map((f, i) => (
              <li key={f.path} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="truncate">{f.name}</span>
                <form action={removeEvidence}>
                  <input type="hidden" name="index" value={i} />
                  <button className="ml-3 shrink-0 text-xs font-medium text-stone-400 hover:text-red-600">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addEvidence} className="mt-4 flex flex-wrap items-center gap-3">
          <input
            className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-warm-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-warm-700 hover:file:bg-warm-100"
            id="document"
            name="document"
            type="file"
            accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
            required
          />
          <button className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors duration-150 hover:border-stone-400">
            Upload document
          </button>
        </form>
      </section>
    </div>
  );
}
