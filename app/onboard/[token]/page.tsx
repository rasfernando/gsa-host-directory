import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, daysUntil } from "@/lib/trips";
import { submitIntake } from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
const labelCls = "block text-sm font-medium";

const TEMPLATE_TITLES: Record<string, string> = {
  gcc: "Global Citizen Camp host intake",
  standard: "Host school intake",
  other: "Partner school intake",
};

// Private "GSA invited you" landing — bypasses the public register form.
export default async function OnboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: inviteRows } = await supabase.rpc("intake_invite_by_token", {
    p_token: token,
  });
  const invite = Array.isArray(inviteRows) ? inviteRows[0] : inviteRows;
  if (!invite) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Soonest open cohort, to set expectations on the evidence window.
  const { data: cohort } = await supabase
    .from("verification_cohorts")
    .select("name, evidence_deadline")
    .eq("status", "open")
    .gte("evidence_deadline", new Date().toISOString().slice(0, 10))
    .order("evidence_deadline", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (invite.used_at) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          This invite has been used
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600">
          The intake for {invite.school_name} was completed on{" "}
          {formatDate(invite.used_at)}. Manage your school from your dashboard.
        </p>
        <Link
          href="/your-school"
          className="mt-6 inline-block rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          Your school
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-warm-600">
        GSA invited you
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {TEMPLATE_TITLES[invite.template] ?? "School intake"} —{" "}
        {invite.school_name}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        {invite.message ||
          "The Global School Alliance would like your school on the platform. Tell us about your school — it takes about ten minutes, and the GSA team handles the rest."}
      </p>
      {cohort && (
        <p className="mt-3 rounded-xl bg-warm-50 p-4 text-sm text-warm-700">
          The <strong>{cohort.name}</strong> verification window closes{" "}
          {formatDate(cohort.evidence_deadline)}
          {daysUntil(cohort.evidence_deadline) != null &&
            ` — ${daysUntil(cohort.evidence_deadline)} days left`}
          . Complete your intake now and submit evidence to make this cohort.
        </p>
      )}

      {!user ? (
        <div className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-stone-600">
            Sign in with your school email to complete the intake — we&apos;ll
            bring you straight back here.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/onboard/${token}`)}`}
            className="mt-4 inline-block rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            Sign in to continue
          </Link>
        </div>
      ) : (
        <form
          action={submitIntake}
          className="mt-8 space-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8"
        >
          <input type="hidden" name="token" value={token} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="school_name">School name</label>
              <input className={inputCls} id="school_name" name="school_name" defaultValue={invite.school_name} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="country">Country</label>
              <input className={inputCls} id="country" name="country" defaultValue={invite.country ?? ""} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="city">City</label>
              <input className={inputCls} id="city" name="city" />
            </div>
            <div>
              <label className={labelCls} htmlFor="website">Website</label>
              <input className={inputCls} id="website" name="website" type="url" placeholder="https://" />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_name">Your name</label>
              <input className={inputCls} id="contact_name" name="contact_name" defaultValue={invite.contact_name ?? ""} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="role_at_school">Your role</label>
              <input className={inputCls} id="role_at_school" name="role_at_school" placeholder="e.g. Deputy Head" />
            </div>
            <div>
              <label className={labelCls} htmlFor="age_range_min">Ages from</label>
              <input className={inputCls} id="age_range_min" name="age_range_min" type="number" min={3} max={19} />
            </div>
            <div>
              <label className={labelCls} htmlFor="age_range_max">Ages to</label>
              <input className={inputCls} id="age_range_max" name="age_range_max" type="number" min={3} max={19} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="capacity">Group capacity</label>
              <input className={inputCls} id="capacity" name="capacity" type="number" min={1} />
            </div>
            <div>
              <label className={labelCls} htmlFor="languages">Languages (comma-separated)</label>
              <input className={inputCls} id="languages" name="languages" placeholder="English, Spanish" />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="boarding" className="accent-warm-600" /> Boarding available
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="homestay" className="accent-warm-600" /> Homestay available
            </label>
          </div>

          {/* Template-specific sections */}
          {invite.template === "gcc" && (
            <fieldset className="rounded-xl bg-warm-50/60 p-4">
              <legend className="px-1 text-sm font-semibold text-warm-700">
                Global Citizen Camp
              </legend>
              <div className="space-y-4">
                <div>
                  <label className={labelCls} htmlFor="gcc_delivery_windows">
                    When could you deliver a camp? (terms/weeks)
                  </label>
                  <input className={inputCls} id="gcc_delivery_windows" name="gcc_delivery_windows" placeholder="e.g. July–August, October half-term" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="gcc_residential" className="accent-warm-600" />
                  Residential facilities on or near site
                </label>
                <div>
                  <label className={labelCls} htmlFor="gcc_excursion_access">
                    Nearby excursions / cultural visits
                  </label>
                  <input className={inputCls} id="gcc_excursion_access" name="gcc_excursion_access" placeholder="e.g. 30 min from the old town, national park nearby" />
                </div>
              </div>
            </fieldset>
          )}
          {invite.template === "standard" && (
            <>
              <div>
                <label className={labelCls} htmlFor="hosting_experience">
                  Hosting experience so far
                </label>
                <textarea className={inputCls} id="hosting_experience" name="hosting_experience" rows={3} />
              </div>
              <div>
                <label className={labelCls} htmlFor="why_host">
                  Why does your school want to host?
                </label>
                <textarea className={inputCls} id="why_host" name="why_host" rows={3} />
              </div>
            </>
          )}
          {invite.template === "other" && (
            <div>
              <label className={labelCls} htmlFor="product_description">
                Tell us what you have in mind
              </label>
              <textarea className={inputCls} id="product_description" name="product_description" rows={4} placeholder="The programme, exchange or partnership you'd like to offer through GSA." />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_name">Safeguarding lead</label>
              <input className={inputCls} id="safeguarding_lead_name" name="safeguarding_lead_name" />
            </div>
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_email">Safeguarding lead email</label>
              <input className={inputCls} id="safeguarding_lead_email" name="safeguarding_lead_email" type="email" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="typical_hosting_windows">Typical hosting windows</label>
            <input className={inputCls} id="typical_hosting_windows" name="typical_hosting_windows" placeholder="e.g. September–November, March–May" />
          </div>

          <button className="rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
            Submit intake to GSA
          </button>
          <p className="text-xs text-stone-500">
            Next: you&apos;ll upload your safeguarding and risk-assessment
            evidence for verification{cohort ? ` before ${formatDate(cohort.evidence_deadline)}` : ""}.
          </p>
        </form>
      )}
    </div>
  );
}
