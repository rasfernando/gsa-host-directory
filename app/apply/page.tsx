import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { submitApplication } from "./actions";
import { HostMonthsField } from "@/components/host-profile-fields";
import Link from "next/link";

const FOCUS_AREAS = [
  "Sustainability",
  "STEM",
  "Inclusion & SEND",
  "Cultural programmes",
  "Digital & AI",
  "Active citizenship",
];

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
const labelCls = "block text-sm font-medium";
const sectionHeadingCls =
  "text-xs font-semibold uppercase tracking-widest text-brand-700";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already applied? Manage it from the dashboard rather than a dead-end.
  const { data: existing } = await supabase
    .from("host_applications")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) redirect("/your-school");

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
        Accreditation
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Apply for GSA accreditation
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-500">
        Signed in as {user?.email}. GSA Accredited schools are the gold
        standard of the network — fully verified, actively promoted to
        visiting groups worldwide, and issued a verification statement
        schools can use for trip approval. The GSA team will contact you to
        complete verification after you submit.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-sm text-warm-700">
          {decodeURIComponent(error)} — please try again, or email
          hello@globalschoolalliance.com if it persists.
        </p>
      )}

      <form action={submitApplication} className="mt-8 space-y-6">
        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>Your school</h2>
          <div>
            <label className={labelCls} htmlFor="school_name">School name</label>
            <input className={inputCls} id="school_name" name="school_name" required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="country">Country</label>
              <input className={inputCls} id="country" name="country" required />
            </div>
            <div>
              <label className={labelCls} htmlFor="city">City</label>
              <input className={inputCls} id="city" name="city" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="website">Website</label>
            <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder="yourschool.org" />
            <p className="mt-1 text-xs text-stone-500">No need for https:// — we&apos;ll add it.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="contact_name">Your name</label>
              <input className={inputCls} id="contact_name" name="contact_name" required />
            </div>
            <div>
              <label className={labelCls} htmlFor="role_at_school">Your role</label>
              <input className={inputCls} id="role_at_school" name="role_at_school" required placeholder="e.g. Headteacher" />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>Hosting capability</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="age_range_min">Ages from</label>
              <input className={inputCls} id="age_range_min" name="age_range_min" type="number" min={3} max={19} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="age_range_max">Ages to</label>
              <input className={inputCls} id="age_range_max" name="age_range_max" type="number" min={3} max={19} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="capacity">Max group size</label>
              <input className={inputCls} id="capacity" name="capacity" type="number" min={1} required />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="languages">Languages spoken (comma-separated)</label>
            <input className={inputCls} id="languages" name="languages" placeholder="English, Spanish" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="subject_strengths">Subject strengths (comma-separated)</label>
            <input className={inputCls} id="subject_strengths" name="subject_strengths" placeholder="Science, Music, Languages" />
          </div>
          <fieldset>
            <legend className={labelCls}>Focus areas</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FOCUS_AREAS.map((area) => (
                <label key={area} className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="focus_areas" value={area} className="rounded border-stone-300" />
                  {area}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="boarding" className="rounded border-stone-300" />
              Boarding available
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="homestay" className="rounded border-stone-300" />
              Homestay available
            </label>
          </div>
          <HostMonthsField />
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>Safeguarding</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_name">Designated safeguarding lead</label>
              <input className={inputCls} id="safeguarding_lead_name" name="safeguarding_lead_name" required />
            </div>
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_email">Their email</label>
              <input className={inputCls} id="safeguarding_lead_email" name="safeguarding_lead_email" type="email" required />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>About your hosting</h2>
          <div>
            <label className={labelCls} htmlFor="hosting_experience">
              Previous hosting / exchange experience
            </label>
            <textarea className={inputCls} id="hosting_experience" name="hosting_experience" rows={3} />
          </div>
          <div>
            <label className={labelCls} htmlFor="why_host">
              Why does your school want to host?
            </label>
            <textarea className={inputCls} id="why_host" name="why_host" rows={3} required />
          </div>
        </section>

        <button
          type="submit"
          className="w-full rounded-lg bg-warm-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          Submit for verification
        </button>
        <p className="text-center text-xs text-stone-500">
          A member of the GSA team will contact you to arrange the
          verification steps — nothing is automated.
        </p>
      </form>
    </div>
  );
}
