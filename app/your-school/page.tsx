import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inputCls, labelCls } from "@/lib/forms";
import { updateContact } from "./actions";

export const dynamic = "force-dynamic";

type MediaItem = { url: string };

export default async function YourSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
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

  const [{ data: school }, { data: profile }, { data: app }] = await Promise.all([
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
      .select("id, status")
      .eq("school_id", up.school_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const cover = (profile?.media as MediaItem[] | null)?.[0]?.url ?? null;
  const appEditable =
    app && ["draft", "submitted", "under_review"].includes(app.status);

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

      {profile?.pending_review && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Changes awaiting GSA review.</strong> Your live profile is
          unchanged until the team approves your edits.
        </p>
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
            <input className={inputCls} id="website" name="website" type="url" placeholder="https://" defaultValue={school?.website ?? ""} />
          </div>
          <button className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
            Save contact details
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
