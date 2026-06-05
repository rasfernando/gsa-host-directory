import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
        ← All host schools
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
            {profile.city ? `${profile.city}, ` : ""}
            {profile.country}
          </p>
        </div>
        {profile.tier === "accredited" ? (
          <Link
            href="/accreditation"
            className="shrink-0 self-start rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-200"
          >
            GSA Accredited host
            {profile.accredited_at &&
              ` · since ${new Date(profile.accredited_at).getFullYear()}`}
          </Link>
        ) : (
          <Link
            href="/accreditation"
            className="shrink-0 self-start rounded-full bg-stone-100 px-3.5 py-1.5 text-xs font-medium text-stone-500 transition-colors duration-150 hover:bg-stone-200"
          >
            Listed host · not yet GSA Accredited
          </Link>
        )}
      </div>

      {profile.tier === "accredited" && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-stone-700">
            <strong>Need sign-off for a trip?</strong> Download the GSA
            verification statement — what we checked and when, ready to hand
            to your head, governors, or EVC.
          </p>
          <Link
            href={`/directory/${profile.slug}/verification`}
            className="shrink-0 rounded-lg bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-800"
          >
            Verification statement
          </Link>
        </div>
      )}

      {profile.headline && (
        <p className="mt-6 text-lg leading-relaxed text-stone-700">
          {profile.headline}
        </p>
      )}
      {profile.description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600">
          {profile.description}
        </p>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 text-sm shadow-sm sm:grid-cols-3">
        <Fact label="Age range">
          {profile.age_range_min != null
            ? `${profile.age_range_min}–${profile.age_range_max}`
            : "—"}
        </Fact>
        <Fact label="Group capacity">{profile.capacity ?? "—"}</Fact>
        <Fact label="Languages">
          {(profile.languages ?? []).join(", ") || "—"}
        </Fact>
        <Fact label="Subject strengths">
          {(profile.subject_strengths ?? []).join(", ") || "—"}
        </Fact>
        <Fact label="Accommodation">
          {[profile.boarding && "Boarding", profile.homestay && "Homestay"]
            .filter(Boolean)
            .join(", ") || "Day visits"}
        </Fact>
        <Fact label="Typical hosting windows">
          {profile.typical_hosting_windows || "Ask GSA"}
        </Fact>
      </dl>

      {(profile.focus_tags ?? []).length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {profile.focus_tags.map((t: string) => (
            <span
              key={t}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Enquiry form */}
      <section className="mt-12 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">
          Enquire about visiting
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
          Enquiries go to the GSA team, who facilitate every visit and will
          come back to you within a few days.
        </p>

        {enquiry === "sent" ? (
          <div className="mt-5 rounded-xl bg-emerald-50 p-5 text-sm text-emerald-900">
            <p className="font-semibold">
              Enquiry sent — here&apos;s what happens next:
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>You&apos;ll get a confirmation email with a copy of your enquiry.</li>
              <li>A member of the GSA team reviews it and contacts you within 2–3 working days.</li>
              <li>GSA introduces you to the school and supports planning from there — you&apos;re never left to arrange things alone.</li>
            </ol>
          </div>
        ) : (
          <form action={submitEnquiry} className="mt-6 space-y-4">
            <input type="hidden" name="host_profile_id" value={profile.id} />
            <input type="hidden" name="slug" value={profile.slug} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="enquirer_school_name">Your school</label>
                <input className={inputCls} id="enquirer_school_name" name="enquirer_school_name" required />
              </div>
              <div>
                <label className={labelCls} htmlFor="enquirer_name">Your name</label>
                <input className={inputCls} id="enquirer_name" name="enquirer_name" required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className={labelCls} htmlFor="enquirer_email">Email</label>
                <input className={inputCls} id="enquirer_email" name="enquirer_email" type="email" required />
              </div>
              <div>
                <label className={labelCls} htmlFor="preferred_dates">Preferred dates</label>
                <input className={inputCls} id="preferred_dates" name="preferred_dates" placeholder="e.g. March 2027" />
              </div>
              <div>
                <label className={labelCls} htmlFor="group_size">Group size</label>
                <input className={inputCls} id="group_size" name="group_size" type="number" min={1} />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="message">What are you hoping to do?</label>
              <textarea
                className={inputCls}
                id="message"
                name="message"
                rows={4}
                required
                placeholder="Tell us about your group, what kind of visit you have in mind, and anything else useful."
              />
            </div>
            <button className="rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-800">
              Send enquiry to the GSA team
            </button>
            <p className="mt-2 text-xs text-stone-500">
              No commitment — this starts a conversation, not a booking.
            </p>
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
