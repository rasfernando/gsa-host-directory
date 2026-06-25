import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, daysUntil } from "@/lib/trips";
import { inputCls, labelCls } from "@/lib/forms";
import {
  RoleField,
  AgeBandField,
  SubjectStrengthsField,
  LanguagesField,
  HostedBeforeField,
  HostMonthsField,
  WhyHostField,
} from "@/components/host-profile-fields";
import { submitIntake } from "../actions";

// Split a stored full name into first / last for prefilling the form.
function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export const dynamic = "force-dynamic";

const TEMPLATE_TITLES: Record<string, string> = {
  gcc: "Global Citizen Camp host intake",
  standard: "Host school intake",
  other: "Partner school intake",
};

// Private "GSA invited you" landing — bypasses the public register form.
export default async function OnboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
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

  // Duplicate check on LOAD (not after submit): if this school has already
  // filed an intake/application, show the "needs further details" state up
  // front rather than a blank form. (A bare AIP skeleton has a profile but no
  // application, so first-time onboarding still gets the form.)
  let alreadySubmitted = invite.used_at != null;
  if (!alreadySubmitted) {
    const schoolId =
      (invite.school_id as string | null) ??
      (user
        ? (
            await supabase
              .from("user_profiles")
              .select("school_id")
              .eq("id", user.id)
              .maybeSingle()
          ).data?.school_id ?? null
        : null);
    if (schoolId) {
      const { data: existingApp } = await supabase
        .from("host_applications")
        .select("id")
        .eq("school_id", schoolId)
        .limit(1)
        .maybeSingle();
      if (existingApp) alreadySubmitted = true;
    }
  }

  if (alreadySubmitted) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Looks like your profile needs some further details…
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600">
          We&apos;ve already got the start of {invite.school_name}&apos;s
          profile. Pick up where you left off and add what&apos;s outstanding.
        </p>
        <Link
          href="/your-school"
          className="mt-6 inline-block rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          Complete Profile
        </Link>
        <p className="mt-4 text-xs text-stone-500">
          Need a hand?{" "}
          <a href="mailto:hello@globalschoolalliance.com" className="underline">
            Get in touch
          </a>
          .
        </p>
      </div>
    );
  }

  // Prefill known contact details from the invite (don't make schools re-type).
  const invited = splitName(invite.contact_name as string | null);

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

      {error && (
        <p className="mt-4 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-sm text-warm-700">
          {decodeURIComponent(error)} — please try again.
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
              <label className={labelCls} htmlFor="state">State / Region</label>
              <input className={inputCls} id="state" name="state" />
            </div>
            <div>
              <label className={labelCls} htmlFor="city">City</label>
              <input className={inputCls} id="city" name="city" />
            </div>
            <div>
              <label className={labelCls} htmlFor="website">Website</label>
              <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder="yourschool.org" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="contact_first_name">First name</label>
              <input className={inputCls} id="contact_first_name" name="contact_first_name" defaultValue={invited.first} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_last_name">Last name</label>
              <input className={inputCls} id="contact_last_name" name="contact_last_name" defaultValue={invited.last} required />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_email">Contact email</label>
            <input className={inputCls} id="contact_email" name="contact_email" type="email" defaultValue={invite.contact_email ?? user.email ?? ""} />
          </div>
          <RoleField />
          <AgeBandField />
          <div>
            <label className={labelCls} htmlFor="capacity">Max student group size</label>
            <input className={inputCls} id="capacity" name="capacity" type="number" min={1} />
          </div>
          <LanguagesField />
          <SubjectStrengthsField />
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="boarding" className="accent-warm-600" /> Boarding available
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="homestay" className="accent-warm-600" /> Homestay available
            </label>
          </div>
          <HostedBeforeField />
          <HostMonthsField />
          <WhyHostField />

          {/* Template-specific sections.
              GCC logistics fields (transport / hotels / restaurants etc.) are
              intentionally removed for now — GCC listings get built up later as
              premium products. To restore, re-add a `gcc` fieldset here and the
              matching answer keys in ../actions.ts. */}
          {(invite.template === "standard" || invite.template === "gcc") && (
            <div>
              <label className={labelCls} htmlFor="hosting_experience">
                Hosting experience so far
              </label>
              <textarea className={inputCls} id="hosting_experience" name="hosting_experience" rows={3} />
            </div>
          )}
          {invite.template === "other" && (
            <div>
              <label className={labelCls} htmlFor="product_description">
                Tell us what you have in mind
              </label>
              <textarea className={inputCls} id="product_description" name="product_description" rows={4} placeholder="The programme, exchange or partnership you'd like to offer through GSA." />
            </div>
          )}

          <div className="rounded-xl bg-stone-50 p-4">
            <p className="text-xs text-stone-500">
              Information here is confidential and only shared internally with
              Global School Alliance.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="safeguarding_lead_name">Safeguarding lead</label>
                <input className={inputCls} id="safeguarding_lead_name" name="safeguarding_lead_name" />
              </div>
              <div>
                <label className={labelCls} htmlFor="safeguarding_lead_email">Safeguarding lead email</label>
                <input className={inputCls} id="safeguarding_lead_email" name="safeguarding_lead_email" type="email" />
              </div>
            </div>
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
