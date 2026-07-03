import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { inputCls, labelCls } from "@/lib/forms";
import {
  RoleField,
  WhyHostField,
  AgeBandField,
  SubjectStrengthsField,
  LanguagesField,
  HostedBeforeField,
  HostMonthsField,
} from "@/components/host-profile-fields";
import { submitListing } from "./actions";

export default async function ListYourSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("listYourSchool");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in? Show the pitch and a sign-in prompt — the public
  // "published" RLS policy means an unfiltered query here would return
  // other schools' listings.
  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
          {t("kicker")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600">
          {t("intro")}
        </p>
        <Link
          href="/login?next=/list-your-school"
          className="mt-8 inline-block rounded-lg bg-warm-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          {t("signInCta")}
        </Link>
        <p className="mt-3 text-xs text-stone-500">
          {t("signInHint")}
        </p>
      </div>
    );
  }

  // Already listed? Show status instead of the form — but only this
  // school's own listing, never the first row RLS happens to return.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  // Already listed? Manage it from the dashboard rather than a dead-end.
  if (profile?.school_id) {
    const { data: existing } = await supabase
      .from("host_profiles")
      .select("id")
      .eq("school_id", profile.school_id)
      .limit(1);
    if (existing && existing.length > 0) redirect("/your-school");
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
        {t("kicker")}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">
        {t("intro")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">
        {t("signedInAs", { email: user?.email ?? "" })}{" "}
        {t.rich("accreditationNote", {
          link: (chunks) => (
            <Link href="/apply" className="underline">
              {chunks}
            </Link>
          ),
        })}
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-warm-200 bg-warm-50 px-4 py-3 text-sm text-warm-700">
          {t("errorBanner", { message: decodeURIComponent(error) })}
        </p>
      )}

      <p className="mt-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        {t("visibilityNote")}
      </p>

      <form
        action={submitListing}
        className="mt-4 space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <label className={labelCls} htmlFor="school_name">{t("schoolNameLabel")}</label>
          <input className={inputCls} id="school_name" name="school_name" required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="country">{t("countryLabel")}</label>
            <input className={inputCls} id="country" name="country" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="state">
              {t("stateLabel")} <span className="font-normal text-stone-500">{t("stateHint")}</span>
            </label>
            <input className={inputCls} id="state" name="state" />
          </div>
          <div>
            <label className={labelCls} htmlFor="city">{t("cityLabel")}</label>
            <input className={inputCls} id="city" name="city" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="contact_first_name">{t("firstNameLabel")}</label>
            <input className={inputCls} id="contact_first_name" name="contact_first_name" required />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_last_name">{t("lastNameLabel")}</label>
            <input className={inputCls} id="contact_last_name" name="contact_last_name" required />
          </div>
        </div>
        <RoleField />
        <div>
          <label className={labelCls} htmlFor="website">{t("websiteLabel")}</label>
          <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder={t("websitePlaceholder")} required />
          <p className="mt-1 text-xs text-stone-500">{t("websiteHint")}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="headline">
            {t("headlineLabel")}
          </label>
          <input className={inputCls} id="headline" name="headline" placeholder={t("headlinePlaceholder")} />
        </div>
        <WhyHostField />
        <AgeBandField />
        <div>
          <label className={labelCls} htmlFor="capacity">{t("capacityLabel")}</label>
          <input className={inputCls} id="capacity" name="capacity" type="number" min={1} />
        </div>
        <LanguagesField />
        <SubjectStrengthsField />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="boarding" className="rounded border-stone-300" />
            {t("boardingLabel")}
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="homestay" className="rounded border-stone-300" />
            {t("homestayLabel")}
          </label>
        </div>
        <HostedBeforeField />
        <HostMonthsField />
        <div>
          <label className={labelCls} htmlFor="photo">
            {t("photoLabel")} <span className="font-normal text-stone-500">{t("photoHint")}</span>
          </label>
          <input
            className="mt-1 w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-warm-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          {t("submitButton")}
        </button>
        <p className="text-center text-xs text-stone-500">
          {t("reviewNote")}
        </p>
      </form>
    </div>
  );
}
