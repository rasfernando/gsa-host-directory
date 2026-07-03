import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("apply");
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
        {t("kicker")}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-500">
        {t("intro", { email: user?.email ?? "" })}
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-sm text-warm-700">
          {t("errorNotice", { error: decodeURIComponent(error) })}
        </p>
      )}

      <form action={submitApplication} className="mt-8 space-y-6">
        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>{t("sectionSchool")}</h2>
          <div>
            <label className={labelCls} htmlFor="school_name">{t("schoolName")}</label>
            <input className={inputCls} id="school_name" name="school_name" required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="country">{t("country")}</label>
              <input className={inputCls} id="country" name="country" required />
            </div>
            <div>
              <label className={labelCls} htmlFor="city">{t("city")}</label>
              <input className={inputCls} id="city" name="city" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="website">{t("website")}</label>
            <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder={t("websitePlaceholder")} />
            <p className="mt-1 text-xs text-stone-500">{t("websiteHint")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="contact_name">{t("contactName")}</label>
              <input className={inputCls} id="contact_name" name="contact_name" required />
            </div>
            <div>
              <label className={labelCls} htmlFor="role_at_school">{t("roleAtSchool")}</label>
              <input className={inputCls} id="role_at_school" name="role_at_school" required placeholder={t("roleAtSchoolPlaceholder")} />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>{t("sectionHosting")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="age_range_min">{t("agesFrom")}</label>
              <input className={inputCls} id="age_range_min" name="age_range_min" type="number" min={3} max={19} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="age_range_max">{t("agesTo")}</label>
              <input className={inputCls} id="age_range_max" name="age_range_max" type="number" min={3} max={19} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="capacity">{t("maxGroupSize")}</label>
              <input className={inputCls} id="capacity" name="capacity" type="number" min={1} required />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="languages">{t("languages")}</label>
            <input className={inputCls} id="languages" name="languages" placeholder={t("languagesPlaceholder")} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="subject_strengths">{t("subjectStrengths")}</label>
            <input className={inputCls} id="subject_strengths" name="subject_strengths" placeholder={t("subjectStrengthsPlaceholder")} />
          </div>
          <fieldset>
            <legend className={labelCls}>{t("focusAreas")}</legend>
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
              {t("boardingAvailable")}
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="homestay" className="rounded border-stone-300" />
              {t("homestayAvailable")}
            </label>
          </div>
          <HostMonthsField />
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>{t("sectionSafeguarding")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_name">{t("safeguardingLead")}</label>
              <input className={inputCls} id="safeguarding_lead_name" name="safeguarding_lead_name" required />
            </div>
            <div>
              <label className={labelCls} htmlFor="safeguarding_lead_email">{t("safeguardingLeadEmail")}</label>
              <input className={inputCls} id="safeguarding_lead_email" name="safeguarding_lead_email" type="email" required />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className={sectionHeadingCls}>{t("sectionAbout")}</h2>
          <div>
            <label className={labelCls} htmlFor="hosting_experience">
              {t("hostingExperience")}
            </label>
            <textarea className={inputCls} id="hosting_experience" name="hosting_experience" rows={3} />
          </div>
          <div>
            <label className={labelCls} htmlFor="why_host">
              {t("whyHost")}
            </label>
            <textarea className={inputCls} id="why_host" name="why_host" rows={3} required />
          </div>
        </section>

        <button
          type="submit"
          className="w-full rounded-lg bg-warm-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          {t("submit")}
        </button>
        <p className="text-center text-xs text-stone-500">
          {t("footnote")}
        </p>
      </form>
    </div>
  );
}
