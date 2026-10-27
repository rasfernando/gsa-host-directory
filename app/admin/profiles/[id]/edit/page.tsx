import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_AREAS, SCHOOL_TYPES } from "@/lib/forms";
import { VERIFICATION_CHECKS } from "@/lib/checklist";
import { HostMonthsField } from "@/components/host-profile-fields";
import {
  adminUpdateProfile,
  adminAddProfilePhoto,
  adminRemoveProfilePhoto,
  adminSetProfileCover,
} from "../../../actions";
import { AvailabilityPanel } from "./availability-panel";
import { NotesPanel } from "./notes-panel";

export const dynamic = "force-dynamic";

type MediaItem = { url: string };

const ERRORS: Record<string, string> = {
  nophoto: "Choose a photo to upload.",
  toobig: "That image is over 5 MB.",
  type: "Photos must be JPG, PNG or WebP.",
  max: "Maximum of 8 photos — remove one to add another.",
};

const SAVED: Record<string, string> = {
  availability: "Availability updated.",
  note: "Note saved.",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";
const labelCls = "block text-sm font-medium text-gray-700";

// yes / no / not known — adminUpdateProfile maps "" to null.
function TriField({ name, label, value }: { name: string; label: string; value: boolean | null | undefined }) {
  const current = value === true ? "yes" : value === false ? "no" : "";
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="mt-2 flex gap-4">
        {[
          { v: "yes", l: "Yes" },
          { v: "no", l: "No" },
          { v: "", l: "Not known" },
        ].map((o) => (
          <label key={o.v || "unknown"} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="radio" name={name} value={o.v} defaultChecked={current === o.v} className="border-gray-300" />
            {o.l}
          </label>
        ))}
      </div>
    </div>
  );
}

export default async function AdminEditProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const supabase = await createClient();

  // "*" rather than a column list so the page keeps working before the
  // Directory V1 migration adds columns (they simply come back undefined).
  const { data } = await supabase
    .from("host_profiles")
    .select("*, schools(*)")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    redirect("/admin/profiles");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = data as Record<string, any>;

  const media = (profile.media as MediaItem[] | null) ?? [];
  const school = (Array.isArray(profile.schools) ? profile.schools[0] : profile.schools) as
    | Record<string, string | null>
    | null;

  // Verification: the school's most recent application, its evidence docs and
  // check statuses — surfaced here with a link through to the full review.
  const { data: app } = await supabase
    .from("host_applications")
    .select("id, status, evidence_files")
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: checkRows } = app
    ? await supabase
        .from("verification_checks")
        .select("check_key, status")
        .eq("application_id", app.id)
    : { data: [] };
  const checkMap = new Map((checkRows ?? []).map((c) => [c.check_key, c.status]));

  type Ev = { name: string; path: string; category?: string };
  const evidence = (app?.evidence_files as Ev[] | null) ?? [];
  const evidenceLinks = await Promise.all(
    evidence.map(async (f) => {
      const { data } = await supabase.storage
        .from("evidence")
        .createSignedUrl(f.path, 600);
      return { ...f, url: data?.signedUrl ?? null };
    })
  );

  const CHECK_BADGES: Record<string, string> = {
    passed: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-600",
    waived: "bg-gray-100 text-gray-500",
    pending: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/profiles" className="text-sm text-gray-500 hover:text-gray-900">
        ← Profiles
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Edit profile — {profile.name || school?.name}
        </h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${profile.published ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
        >
          {profile.published ? "Published" : "Unpublished"}
        </span>
        <Link
          href={`/admin/profiles/${id}/catalogue`}
          className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Catalogue profile →
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Edits apply immediately and go live — no separate approval step. Changes
        re-translate and re-pin the map automatically.
      </p>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {SAVED[saved] ?? "Saved."}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {ERRORS[error] ?? decodeURIComponent(error)}
        </p>
      )}

      {/* Verification */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Verification</h2>
          {app && (
            <Link
              href={`/admin/applications/${app.id}`}
              className="text-xs font-medium text-blue-700 underline"
            >
              Open full review →
            </Link>
          )}
        </div>
        {!app ? (
          <p className="mt-2 text-sm text-gray-500">
            No verification application on file yet — this school hasn&apos;t
            submitted evidence for review.
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-1.5">
              {VERIFICATION_CHECKS.map((c) => {
                const st = checkMap.get(c.key) ?? "pending";
                return (
                  <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-700">{c.label}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CHECK_BADGES[st] ?? CHECK_BADGES.pending}`}
                    >
                      {st}
                    </span>
                  </li>
                );
              })}
            </ul>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Documents
            </h3>
            {evidenceLinks.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">No documents uploaded.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {evidenceLinks.map((f) => (
                  <li key={f.path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      {f.category && (
                        <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                          {f.category.replace(/_/g, " ")}
                        </span>
                      )}
                      {f.name}
                    </span>
                    {f.url ? (
                      <a href={f.url} target="_blank" className="shrink-0 text-xs font-medium text-blue-700 underline">
                        View
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-400">unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Photos */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">Photos</h2>
        <p className="mt-1 text-xs text-gray-500">First photo is the cover.</p>
        {media.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((m, i) => (
              <li key={m.url} className="overflow-hidden rounded-lg border border-gray-200">
                <div className="relative aspect-[3/2] bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-gray-900/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Cover
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-2">
                  {i === 0 ? (
                    <span className="text-[11px] text-gray-400">Cover</span>
                  ) : (
                    <form action={adminSetProfileCover}>
                      <input type="hidden" name="profile_id" value={id} />
                      <input type="hidden" name="index" value={i} />
                      <button className="text-[11px] font-semibold text-gray-700 hover:text-gray-900">
                        Set cover
                      </button>
                    </form>
                  )}
                  <form action={adminRemoveProfilePhoto}>
                    <input type="hidden" name="profile_id" value={id} />
                    <input type="hidden" name="index" value={i} />
                    <button className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Remove" aria-label="Remove photo">
                      ✕
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No photos yet.
          </p>
        )}
        {media.length < 8 && (
          <form action={adminAddProfilePhoto} className="mt-4 flex flex-wrap items-center gap-3">
            <input type="hidden" name="profile_id" value={id} />
            <input
              className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
            <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
              Add photo
            </button>
          </form>
        )}
      </section>

      {/* Details */}
      <form action={adminUpdateProfile} className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <input type="hidden" name="profile_id" value={id} />
        <input type="hidden" name="school_id" value={profile.school_id ?? ""} />
        <h2 className="text-sm font-semibold text-gray-900">Details</h2>
        <div>
          <label className={labelCls} htmlFor="name">Display name</label>
          <input className={inputCls} id="name" name="name" defaultValue={profile.name ?? ""} />
        </div>
        <div>
          <label className={labelCls} htmlFor="headline">One-line description</label>
          <input className={inputCls} id="headline" name="headline" defaultValue={profile.headline ?? ""} />
        </div>
        <div>
          <label className={labelCls} htmlFor="description">About the school</label>
          <textarea className={inputCls} id="description" name="description" rows={4} defaultValue={profile.description ?? ""} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="city">City</label>
            <input className={inputCls} id="city" name="city" defaultValue={profile.city ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="state">State / Region</label>
            <input className={inputCls} id="state" name="state" defaultValue={profile.state ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="postcode">Postcode</label>
            <input className={inputCls} id="postcode" name="postcode" defaultValue={profile.postcode ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="age_range_min">Ages from</label>
            <input className={inputCls} id="age_range_min" name="age_range_min" type="number" min={3} max={19} defaultValue={profile.age_range_min ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="age_range_max">Ages to</label>
            <input className={inputCls} id="age_range_max" name="age_range_max" type="number" min={3} max={19} defaultValue={profile.age_range_max ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="capacity">Max group size</label>
            <input className={inputCls} id="capacity" name="capacity" type="number" min={1} defaultValue={profile.capacity ?? ""} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="languages">Languages (comma-separated)</label>
          <input className={inputCls} id="languages" name="languages" defaultValue={(profile.languages ?? []).join(", ")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="subject_strengths">Subject strengths (comma-separated)</label>
          <input className={inputCls} id="subject_strengths" name="subject_strengths" defaultValue={(profile.subject_strengths ?? []).join(", ")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="why_host">Why they host</label>
          <textarea className={inputCls} id="why_host" name="why_host" rows={3} defaultValue={profile.why_host ?? ""} />
        </div>
        <fieldset>
          <legend className={labelCls}>Focus areas</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FOCUS_AREAS.map((area) => (
              <label key={area} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="focus_areas" value={area} defaultChecked={(profile.focus_tags ?? []).includes(area)} className="rounded border-gray-300" />
                {area}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="boarding" defaultChecked={Boolean(profile.boarding)} className="rounded border-gray-300" />
            Boarding available
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="homestay" defaultChecked={Boolean(profile.homestay)} className="rounded border-gray-300" />
            Homestay available
          </label>
        </div>
        <div>
          <span className={labelCls}>Hosting months</span>
          <HostMonthsField defaultValue={(profile.host_months as string[] | null) ?? []} />
        </div>
        <div>
          <label className={labelCls} htmlFor="typical_hosting_windows">Typical hosting windows (free text)</label>
          <input className={inputCls} id="typical_hosting_windows" name="typical_hosting_windows" defaultValue={profile.typical_hosting_windows ?? ""} placeholder="e.g. first two weeks of June, October half term" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TriField name="hosted_before" label="Hosted with GSA before?" value={profile.hosted_before} />
          <TriField name="host_multiple_per_year" label="Happy to host more than once a year?" value={profile.host_multiple_per_year} />
        </div>

        {/* Contact — lives on the school record */}
        <h2 className="pt-2 text-sm font-semibold text-gray-900">Contact</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="contact_name">Contact name</label>
            <input className={inputCls} id="contact_name" name="contact_name" defaultValue={school?.contact_name ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_role">Role</label>
            <input className={inputCls} id="contact_role" name="contact_role" defaultValue={school?.contact_role ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_email">Email</label>
            <input className={inputCls} id="contact_email" name="contact_email" type="email" defaultValue={school?.contact_email ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="contact_phone">Phone</label>
            <input className={inputCls} id="contact_phone" name="contact_phone" type="tel" defaultValue={school?.contact_phone ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="website">Website</label>
            <input className={inputCls} id="website" name="website" defaultValue={school?.website ?? ""} />
          </div>
        </div>

        {/* Catalogue — the profile GSA sends to agents */}
        <h2 className="pt-2 text-sm font-semibold text-gray-900">Catalogue profile</h2>
        <p className="-mt-2 text-xs text-gray-500">
          These fill the printable profile for agents. Leave a section blank and it falls back to the details above.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="school_type">Type of school</label>
            <select className={inputCls} id="school_type" name="school_type" defaultValue={profile.school_type ?? ""}>
              <option value="">Not set</option>
              {[...SCHOOL_TYPES, ...(profile.school_type && !(SCHOOL_TYPES as readonly string[]).includes(profile.school_type) ? [profile.school_type] : [])].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="ofsted_rating">Ofsted rating</label>
            <input className={inputCls} id="ofsted_rating" name="ofsted_rating" defaultValue={profile.ofsted_rating ?? ""} placeholder="Good" />
          </div>
          <div>
            <label className={labelCls} htmlFor="prospectus_url">Prospectus link</label>
            <input className={inputCls} id="prospectus_url" name="prospectus_url" defaultValue={profile.prospectus_url ?? ""} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="overview">Overview</label>
          <textarea className={inputCls} id="overview" name="overview" rows={4} defaultValue={profile.overview ?? ""} />
        </div>
        <div>
          <label className={labelCls} htmlFor="culture">Student body &amp; culture</label>
          <textarea className={inputCls} id="culture" name="culture" rows={4} defaultValue={profile.culture ?? ""} />
        </div>
        <div>
          <label className={labelCls} htmlFor="curriculum">Curriculum &amp; subjects</label>
          <textarea className={inputCls} id="curriculum" name="curriculum" rows={4} defaultValue={profile.curriculum ?? ""} placeholder="Blank = the subject strengths list above" />
        </div>
        <div>
          <label className={labelCls} htmlFor="enrichment">Enrichment &amp; extracurricular</label>
          <textarea className={inputCls} id="enrichment" name="enrichment" rows={3} defaultValue={profile.enrichment ?? ""} />
        </div>
        <div>
          <label className={labelCls} htmlFor="standout">What makes the school stand out</label>
          <textarea className={inputCls} id="standout" name="standout" rows={3} defaultValue={profile.standout ?? ""} placeholder="Blank = 'Why they host' above" />
        </div>

        <button className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700">
          Save changes
        </button>
      </form>

      <AvailabilityPanel profileId={id} />
      <NotesPanel profileId={id} />
    </div>
  );
}
