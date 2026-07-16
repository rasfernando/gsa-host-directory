import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inputCls, labelCls } from "@/lib/forms";
import { formatDate } from "@/lib/trips";
import { getBookedWindows } from "@/lib/availability";
import { creditHistory, CREDIT_REASON_LABELS } from "@/lib/credits";
import { updateContact, changePassword } from "./actions";

export const dynamic = "force-dynamic";

type MediaItem = { url: string };

export default async function YourSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; intake?: string; pw?: string }>;
}) {
  const { saved, intake, pw } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/your-school");

  const { data: up } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  // No school yet → send them to the entry points.
  if (!up?.school_id) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Your school</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600">
          You haven&apos;t registered a school yet. List your school to join the
          directory, or apply for GSA accreditation.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/list-your-school"
            className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            List your school
          </Link>
          <Link
            href="/apply"
            className="rounded-lg border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors duration-150 hover:border-stone-400"
          >
            Apply for accreditation
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: school }, { data: profile }, { data: app }, { data: cohort }] =
    await Promise.all([
      supabase
        .from("schools")
        .select("name, contact_name, contact_email, website")
        .eq("id", up.school_id)
        .single(),
      supabase
        .from("host_profiles")
        .select("id, name, slug, tier, published, media, pending_review")
        .eq("school_id", up.school_id)
        .maybeSingle(),
      supabase
        .from("host_applications")
        .select("id, status, info_request, cohort_id")
        .eq("school_id", up.school_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("verification_cohorts")
        .select("id, name, evidence_deadline")
        .eq("status", "open")
        .gte("evidence_deadline", new Date().toISOString().slice(0, 10))
        .order("evidence_deadline", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const cover = (profile?.media as MediaItem[] | null)?.[0]?.url ?? null;
  const appEditable =
    app && ["draft", "submitted", "under_review", "info_requested"].includes(app.status);
  // Verification is batched: show the evidence window while the school is
  // still working towards verified (no decided application yet).
  const showCohortBanner =
    cohort && (!profile || profile.tier === "listed") && app?.status !== "approved";
  const cohortDaysLeft = cohort
    ? Math.ceil(
        (new Date(cohort.evidence_deadline).getTime() - Date.now()) / 86_400_000
      )
    : null;

  // Groups booked to visit this school (RLS hides the trips otherwise; the RPC
  // exposes the windows). Future visits only.
  const today = new Date().toISOString().slice(0, 10);
  const bookings = profile
    ? (await getBookedWindows(profile.id)).filter((w) => w.end_date >= today)
    : [];

  const credits = await creditHistory(supabase, up.school_id);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
        Your school
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {school?.name ?? "Your school"}
      </h1>

      {saved === "contact" && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Contact details saved.
        </p>
      )}

      {intake === "submitted" && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p>
            You&apos;ve submitted your profile! This information will now be
            reviewed by Global School Alliance. Get in touch if you require
            support.
          </p>
          <a
            href="mailto:hello@globalschoolalliance.com"
            className="mt-2 inline-block font-semibold underline"
          >
            Get in touch
          </a>
        </div>
      )}

      {showCohortBanner && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-800">
            Next verification cohort closes in {cohortDaysLeft} day
            {cohortDaysLeft === 1 ? "" : "s"} —{" "}
            {new Date(cohort!.evidence_deadline).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
            })}
          </p>
          <p className="mt-1 text-sm text-brand-800/80">
            Submit your safeguarding and risk-assessment evidence to be
            verified in the {cohort!.name}. Verified schools appear on the
            marketplace and can take bookings.
          </p>
          <Link
            href={app ? "/your-school/application" : "/apply"}
            className="mt-3 inline-block rounded-lg bg-warm-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            {app ? "Submit your evidence →" : "Start your application →"}
          </Link>
        </div>
      )}

      {profile?.pending_review && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Changes awaiting GSA review.</strong> Your live profile is
          unchanged until the team approves your edits.
        </p>
      )}

      {app?.status === "info_requested" && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            The GSA team needs more information
          </p>
          {app.info_request && (
            <p className="mt-1 text-sm text-amber-900">“{app.info_request}”</p>
          )}
          <Link
            href="/your-school/application"
            className="mt-3 inline-block rounded-lg bg-warm-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
          >
            Respond now →
          </Link>
        </div>
      )}

      {/* Status + profile card */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
        <div className="flex gap-4 p-5">
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-warm-50 to-warm-100">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-warm-300">
                {(school?.name ?? "?").charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge profile={profile} />
              {profile?.tier === "accredited" && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  GSA Accredited
                </span>
              )}
              {profile?.tier === "verified" && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                  GSA Verified
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-stone-600">
              {profile
                ? profile.published
                  ? "Your listing is live in the directory."
                  : "Your listing is with the GSA team for review before it goes live."
                : "No directory listing yet."}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {profile && (
                <Link
                  href="/your-school/listing"
                  className="font-semibold text-warm-700 transition-colors duration-150 hover:text-warm-600"
                >
                  Edit listing &amp; photos →
                </Link>
              )}
              {profile?.published && (
                <Link
                  href={`/directory/${profile.slug}`}
                  className="text-stone-500 underline transition-colors duration-150 hover:text-stone-900"
                >
                  View live
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Accreditation application status */}
      {app && (
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold">
              Accreditation application — {app.status.replace("_", " ")}
            </p>
            <p className="mt-0.5 text-sm text-stone-500">
              {appEditable
                ? "You can still edit your answers until the GSA team makes a decision."
                : app.status === "approved"
                  ? "Your school is GSA Accredited."
                  : "This application has been decided and is now read-only."}
            </p>
          </div>
          {appEditable && (
            <Link
              href="/your-school/application"
              className="shrink-0 font-semibold text-warm-700 transition-colors duration-150 hover:text-warm-600"
            >
              Edit →
            </Link>
          )}
        </section>
      )}

      {!profile && !app && (
        <p className="mt-4 rounded-xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Ready to go further?{" "}
          <Link href="/apply" className="font-semibold text-warm-700 underline">
            Apply for GSA accreditation →
          </Link>
        </p>
      )}

      {/* Groups booked to visit */}
      {profile && (
        <section className="mt-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold tracking-tight">
            Groups booked to visit you
          </h2>
          {bookings.length === 0 ? (
            <p className="mt-1 text-sm text-stone-500">
              No visiting groups booked yet. When a school reserves a trip to
              your school, the dates will appear here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200/70">
              {bookings.map((w) => (
                <li key={w.trip_id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-stone-700">
                    {formatDate(w.start_date)} – {formatDate(w.end_date)}
                    {w.num_students ? ` · ${w.num_students} students` : ""}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      w.status === "confirmed"
                        ? "bg-brand-700 text-white"
                        : w.status === "invoiced" || w.status === "deposit_paid"
                          ? "bg-brand-50 text-brand-700"
                          : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {w.status === "deposit_paid"
                      ? "deposit paid"
                      : w.status === "confirmed"
                        ? "confirmed"
                        : w.status === "invoiced"
                          ? "invoiced"
                          : "reserved"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-500">
            Dates are shown so you can plan around them. The GSA team confirms
            every visit with you directly.
          </p>
        </section>
      )}

      {/* GSA credits */}
      <section className="mt-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold tracking-tight">Your GSA credits</h2>
          <p className="text-2xl font-bold text-brand-700">{credits.balance}</p>
        </div>
        {credits.rows.length === 0 ? (
          <p className="mt-1 text-sm text-stone-500">
            You&apos;ll earn credits as your school takes part — getting
            verified, booking trips, hosting groups and referring schools.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200/70">
            {credits.rows.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="text-stone-700">
                  {CREDIT_REASON_LABELS[r.reason] ?? r.reason}
                  {r.note ? (
                    <span className="text-stone-400"> — {r.note}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-stone-400">
                    {formatDate(r.created_at)}
                  </span>
                  <span
                    className={`font-semibold ${r.delta < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {r.delta > 0 ? `+${r.delta}` : r.delta}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Contact details */}
      <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold tracking-tight">Contact details</h2>
        <p className="mt-1 text-sm text-stone-500">
          Where the GSA team reaches you about your school.
        </p>
        <form action={updateContact} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="contact_name">Your name</label>
              <input className={inputCls} id="contact_name" name="contact_name" defaultValue={school?.contact_name ?? ""} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="contact_email">Email</label>
              <input className={inputCls} id="contact_email" name="contact_email" type="email" defaultValue={school?.contact_email ?? ""} required />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="website">School website</label>
            <input className={inputCls} id="website" name="website" type="text" inputMode="url" placeholder="yourschool.org" defaultValue={school?.website ?? ""} />
          </div>
          <button className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
            Save contact details
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="mt-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold tracking-tight">Password</h2>
        <p className="mt-1 text-sm text-stone-500">
          Set or change your sign-in password. Minimum 8 characters.
        </p>
        {pw === "changed" && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            Password updated.
          </p>
        )}
        {pw === "short" && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            Password must be at least 8 characters.
          </p>
        )}
        {pw === "error" && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            Could not update password — please try again.
          </p>
        )}
        <form action={changePassword} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className={labelCls} htmlFor="password">New password</label>
            <input
              className={inputCls}
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>
          <button className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}

function StatusBadge({
  profile,
}: {
  profile: { published: boolean } | null;
}) {
  if (!profile)
    return (
      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-500">
        No listing
      </span>
    );
  return profile.published ? (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
      Live
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
      Awaiting review
    </span>
  );
}
