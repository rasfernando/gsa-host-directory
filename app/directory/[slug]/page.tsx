import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n-content";
import { DirectoryMap } from "@/components/directory-map";
import { submitEnquiry } from "./actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
const labelCls = "block text-sm font-medium";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enquiry?: string }>;
}) {
  const { slug } = await params;
  const { enquiry } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("profile");
  const tv = await getTranslations("vocab");
  // Enumerable DB values (countries, languages, subjects, focus tags)
  // translate via the vocab dictionary, falling back to the raw value.
  const v = (s: string) => (tv.has(s) ? tv(s) : s);
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("host_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/directory"
        className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900"
      >
        ← {t("allHosts")}
      </Link>

      {(profile.media as { url: string }[] | null)?.[0]?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={(profile.media as { url: string }[])[0].url}
          alt={`${profile.name} campus`}
          className="mt-5 aspect-[2/1] w-full rounded-2xl object-cover shadow-sm"
        />
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {profile.name}
          </h1>
          <p className="mt-1.5 text-stone-500">
            {localized(profile, "city", locale)
              ? `${localized(profile, "city", locale)}, `
              : ""}
            {v(profile.country)}
          </p>
        </div>
        {profile.tier === "accredited" ? (
          <Link
            href="/accreditation"
            className="shrink-0 self-start rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-200"
          >
            {t("accreditedHost")}
            {profile.accredited_at &&
              ` · ${t("accreditedSince")} ${new Date(profile.accredited_at).getFullYear()}`}
          </Link>
        ) : profile.tier === "verified" ? (
          <Link
            href="/accreditation"
            className="shrink-0 self-start rounded-full bg-brand-100 px-3.5 py-1.5 text-xs font-semibold text-brand-800 transition-colors duration-150 hover:bg-brand-200"
          >
            {t("verifiedHost")}
          </Link>
        ) : (
          <Link
            href="/accreditation"
            className="shrink-0 self-start rounded-full bg-stone-100 px-3.5 py-1.5 text-xs font-medium text-stone-500 transition-colors duration-150 hover:bg-stone-200"
          >
            {t("listedHost")}
          </Link>
        )}
      </div>

      {profile.tier === "accredited" && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-stone-700">
            <strong>{t("verificationLead")}</strong> {t("verificationBody")}
          </p>
          <Link
            href={`/directory/${profile.slug}/verification`}
            className="shrink-0 rounded-lg bg-warm-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            {t("verificationCta")}
          </Link>
        </div>
      )}

      {localized(profile, "headline", locale) && (
        <p className="mt-6 text-lg leading-relaxed text-stone-700">
          {localized(profile, "headline", locale)}
        </p>
      )}
      {localized(profile, "description", locale) && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600">
          {localized(profile, "description", locale)}
        </p>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 text-sm shadow-sm sm:grid-cols-3">
        <Fact label={t("ageRange")}>
          {profile.age_range_min != null
            ? `${profile.age_range_min}–${profile.age_range_max}`
            : "—"}
        </Fact>
        <Fact label={t("groupCapacity")}>{profile.capacity ?? "—"}</Fact>
        <Fact label={t("languages")}>
          {(profile.languages ?? []).map(v).join(", ") || "—"}
        </Fact>
        <Fact label={t("subjectStrengths")}>
          {(profile.subject_strengths ?? []).map(v).join(", ") || "—"}
        </Fact>
        <Fact label={t("accommodation")}>
          {[
            profile.boarding && t("boardingLabel"),
            profile.homestay && t("homestayLabel"),
          ]
            .filter(Boolean)
            .join(", ") || t("dayVisits")}
        </Fact>
        <Fact label={t("hostingWindows")}>
          {(profile.host_months ?? []).length > 0
            ? (profile.host_months as string[]).map(v).join(", ")
            : localized(profile, "typical_hosting_windows", locale) || t("askGsa")}
        </Fact>
        {profile.ofsted_rating && (
          <Fact label={t("ofsted")}>{profile.ofsted_rating}</Fact>
        )}
      </dl>

      {/* Where in the world */}
      {profile.lat != null &&
        profile.lng != null &&
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
          <div className="mt-5">
            <DirectoryMap
              schools={[
                {
                  id: profile.id,
                  name: profile.name,
                  slug: profile.slug,
                  city: localized(profile, "city", locale),
                  country: v(profile.country),
                  tier: profile.tier,
                  lat: profile.lat,
                  lng: profile.lng,
                },
              ]}
              height="h-72"
              zoomToSingle
            />
          </div>
        )}

      {(profile.focus_tags ?? []).length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {profile.focus_tags.map((tag: string) => (
            <span
              key={tag}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600"
            >
              {v(tag)}
            </span>
          ))}
        </div>
      )}

      {/* Plan a trip: the transactional path */}
      <section className="mt-10 flex flex-col gap-4 rounded-2xl border border-warm-200/70 bg-warm-50/50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t("planTitle", { name: profile.name })}
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
            {t("planBody")}
          </p>
        </div>
        <Link
          href={`/trips/new?host=${profile.slug}`}
          className="shrink-0 self-start rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700 sm:self-center"
        >
          {t("planCta")}
        </Link>
      </section>

      {/* Enquiry form */}
      <section className="mt-12 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">{t("enquireTitle")}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
          {t("enquireBody")}
        </p>

        {enquiry === "sent" ? (
          <div className="mt-5 rounded-xl bg-emerald-50 p-5 text-sm text-emerald-900">
            <p className="font-semibold">{t("sentTitle")}</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>{t("sentStep1")}</li>
              <li>{t("sentStep2")}</li>
              <li>{t("sentStep3")}</li>
            </ol>
          </div>
        ) : (
          <form action={submitEnquiry} className="mt-6 space-y-4">
            <input type="hidden" name="host_profile_id" value={profile.id} />
            <input type="hidden" name="slug" value={profile.slug} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="enquirer_school_name">{t("yourSchool")}</label>
                <input className={inputCls} id="enquirer_school_name" name="enquirer_school_name" required />
              </div>
              <div>
                <label className={labelCls} htmlFor="enquirer_name">{t("yourName")}</label>
                <input className={inputCls} id="enquirer_name" name="enquirer_name" required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className={labelCls} htmlFor="enquirer_email">{t("email")}</label>
                <input className={inputCls} id="enquirer_email" name="enquirer_email" type="email" required />
              </div>
              <div>
                <label className={labelCls} htmlFor="preferred_dates">{t("preferredDates")}</label>
                <input className={inputCls} id="preferred_dates" name="preferred_dates" placeholder={t("preferredDatesHint")} />
              </div>
              <div>
                <label className={labelCls} htmlFor="group_size">{t("groupSize")}</label>
                <input className={inputCls} id="group_size" name="group_size" type="number" min={1} />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="message">{t("message")}</label>
              <textarea
                className={inputCls}
                id="message"
                name="message"
                rows={4}
                required
                placeholder={t("messageHint")}
              />
            </div>
            <button className="rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
              {t("send")}
            </button>
            <p className="mt-2 text-xs text-stone-500">{t("noCommitment")}</p>
          </form>
        )}
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 text-stone-800">{children}</dd>
    </div>
  );
}
