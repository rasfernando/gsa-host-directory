import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_AREAS } from "@/lib/forms";
import { HostMonthsField } from "@/components/host-profile-fields";
import {
  adminUpdateProfile,
  adminAddProfilePhoto,
  adminRemoveProfilePhoto,
  adminSetProfileCover,
} from "../../../actions";

export const dynamic = "force-dynamic";

type MediaItem = { url: string };

const ERRORS: Record<string, string> = {
  nophoto: "Choose a photo to upload.",
  toobig: "That image is over 5 MB.",
  type: "Photos must be JPG, PNG or WebP.",
  max: "Maximum of 8 photos — remove one to add another.",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";
const labelCls = "block text-sm font-medium text-gray-700";

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

  const { data: profile } = await supabase
    .from("host_profiles")
    .select(
      "id, name, slug, published, tier, media, headline, description, city, state, why_host, languages, subject_strengths, focus_tags, boarding, homestay, age_range_min, age_range_max, capacity, host_months, schools(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    redirect("/admin/profiles");
  }

  const media = (profile.media as MediaItem[] | null) ?? [];
  const school = Array.isArray(profile.schools) ? profile.schools[0] : profile.schools;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/profiles" className="text-sm text-gray-500 hover:text-gray-900">
        ← Profiles
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Edit profile — {profile.name || school?.name}
        </h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${profile.published ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
        >
          {profile.published ? "Published" : "Unpublished"}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Edits apply immediately and go live — no separate approval step. Changes
        re-translate and re-pin the map automatically.
      </p>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Saved.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {ERRORS[error] ?? decodeURIComponent(error)}
        </p>
      )}

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="city">City</label>
            <input className={inputCls} id="city" name="city" defaultValue={profile.city ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="state">State / Region</label>
            <input className={inputCls} id="state" name="state" defaultValue={profile.state ?? ""} />
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
        <button className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700">
          Save changes
        </button>
      </form>
    </div>
  );
}
