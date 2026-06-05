import { createClient } from "@/lib/supabase/server";
import { submitApplication } from "./actions";
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
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";
const labelCls = "block text-sm font-medium";

export default async function ApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If this school already has an application, show its status instead of the form
  const { data: existing } = await supabase
    .from("host_applications")
    .select("id, status, submitted_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    const app = existing[0];
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Application {app.status.replace("_", " ")}
        </h1>
        <p className="mt-3 text-gray-500">
          {app.status === "approved"
            ? "Congratulations — your school is an accredited GSA host school."
            : app.status === "rejected"
              ? "Your application was not approved this time. GSA will be in touch with feedback."
              : "Your application is with the GSA team. We review every school personally and will contact you to arrange verification."}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-gray-500 underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Apply for GSA accreditation
      </h1>
      <p className="mb-8 mt-2 text-sm text-gray-500">
        Signed in as {user?.email}. GSA Accredited schools are the gold
        standard of the network — fully verified, actively promoted to
        visiting groups worldwide, and issued a verification statement
        schools can use for trip approval. The GSA team will contact you to
        complete verification after you submit.
      </p>

      <form action={submitApplication} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Your school
          </h2>
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
            <input className={inputCls} id="website" name="website" type="url" placeholder="https://" />
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

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Hosting capability
          </h2>
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
                <label key={area} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="focus_areas" value={area} className="rounded border-gray-300" />
                  {area}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="boarding" className="rounded border-gray-300" />
              Boarding available
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="homestay" className="rounded border-gray-300" />
              Homestay available
            </label>
          </div>
          <div>
            <label className={labelCls} htmlFor="typical_hosting_windows">
              When can you typically host? (free text)
            </label>
            <input className={inputCls} id="typical_hosting_windows" name="typical_hosting_windows" placeholder="e.g. September–November, term time only" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Safeguarding
          </h2>
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

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            About your hosting
          </h2>
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
          className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700"
        >
          Submit application
        </button>
      </form>
    </div>
  );
}
