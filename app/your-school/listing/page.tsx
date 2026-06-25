import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_AREAS, inputCls, labelCls } from "@/lib/forms";
import { HostMonthsField } from "@/components/host-profile-fields";
import {
  updateListing,
  addPhoto,
  setCover,
  removePhoto,
} from "../actions";

export const dynamic = "force-dynamic";

type MediaItem = { url: string; type?: string };

const ERRORS: Record<string, string> = {
  nophoto: "Please choose a photo to upload.",
  toobig: "That image is over 5 MB — please upload a smaller file.",
  type: "Photos must be JP, PNG, or WebP.",
  max: "You've reached the maximum of 8 photos. Remove one to add another.",
};

export default async function EditListingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; staged?: string; error?: string }>;
}) {
  const { saved, staged, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/your-school/listing");

  const { data: up } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();
  if (!up?.school_id) redirect("/your-school");

  const { data: profile } = await supabase
    .from("host_profiles")
    .select(
      "id, name, published, media, pending_changes, pending_review, headline, description, city, languages, age_range_min, age_range_max, subject_strengths, focus_tags, boarding, homestay, capacity, host_months"
    )
    .eq("school_id", up.school_id)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">No listing yet</h1>
        <p className="mt-3 text-sm text-stone-600">
          You don&apos;t have a directory listing to edit.
        </p>
        <Link href="/your-school" className="mt-6 inline-block text-sm text-stone-500 underline">
          ← Back to your school
        </Link>
      </div>
    );
  }

  // When published, edits operate on the staged copy (pending re-approval).
  const staged_changes = (profile.pending_changes as Record<string, unknown>) ?? {};
  const live = !profile.published;
  const v = <T,>(field: string, fallback: T): T =>
    live ? fallback : ((staged_changes[field] as T) ?? fallback);

  const media: MediaItem[] = profile.published
    ? ((staged_changes.media as MediaItem[]) ?? (profile.media as MediaItem[]) ?? [])
    : ((profile.media as MediaItem[]) ?? []);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/your-school" className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900">
        ← Your school
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Edit your listing</h1>

      {!live && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your profile is <strong>live and verified</strong>. Changes are saved
          as a draft and go public only after the GSA team approves them — your
          current listing stays up in the meantime.
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Saved.
        </p>
      )}
      {staged && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Changes submitted for review — they&apos;ll go live once approved.
        </p>
      )}
      {error && ERRORS[error] && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {ERRORS[error]}
        </p>
      )}

      {/* Photos */}
      <section className="mt-8 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold tracking-tight">Photos</h2>
        <p className="mt-1 text-sm text-stone-500">
          The first photo is your cover. Listings with photos get far more
          interest.
        </p>

        {media.length > 0 ? (
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {media.map((m, i) => (
              <li key={m.url} className="overflow-hidden rounded-xl border border-stone-200/70">
                <div className="relative aspect-[3/2] bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-brand-800/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Cover
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-2">
                  {i === 0 ? (
                    <span className="text-[11px] text-stone-400">Cover photo</span>
                  ) : (
                    <form action={setCover}>
                      <input type="hidden" name="index" value={i} />
                      <button className="text-[11px] font-semibold text-warm-700 hover:text-warm-600">
                        Set as cover
                      </button>
                    </form>
                  )}
                  <form action={removePhoto}>
                    <input type="hidden" name="index" value={i} />
                    <button className="rounded p-1.5 text-stone-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600" title="Remove photo" aria-label="Remove photo">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            No photos yet. Add one below.
          </p>
        )}

        {media.length < 8 && (
          <form action={addPhoto} className="mt-5 flex flex-wrap items-center gap-3">
            <input
              className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-warm-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-warm-700 hover:file:bg-warm-100"
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
            <button className="rounded-lg bg-warm-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
              Add photo
            </button>
          </form>
        )}
      </section>

      {/* Details */}
      <form action={updateListing} className="mt-6 space-y-4 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold tracking-tight">Details</h2>
        <div>
          <label className={labelCls} htmlFor="headline">One-line description</label>
          <input className={inputCls} id="headline" name="headline" defaultValue={v("headline", profile.headline) ?? ""} />
        </div>
        <div>
          <label className={labelCls} htmlFor="description">About your school</label>
          <textarea className={inputCls} id="description" name="description" rows={4} defaultValue={v("description", profile.description) ?? ""} />
        </div>
        <div>
          <label className={labelCls} htmlFor="city">City</label>
          <input className={inputCls} id="city" name="city" defaultValue={v("city", profile.city) ?? ""} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="age_range_min">Ages from</label>
            <input className={inputCls} id="age_range_min" name="age_range_min" type="number" min={3} max={19} defaultValue={v("age_range_min", profile.age_range_min) ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="age_range_max">Ages to</label>
            <input className={inputCls} id="age_range_max" name="age_range_max" type="number" min={3} max={19} defaultValue={v("age_range_max", profile.age_range_max) ?? ""} />
          </div>
          <div>
            <label className={labelCls} htmlFor="capacity">Max group size</label>
            <input className={inputCls} id="capacity" name="capacity" type="number" min={1} defaultValue={v("capacity", profile.capacity) ?? ""} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="languages">Languages (comma-separated)</label>
          <input className={inputCls} id="languages" name="languages" defaultValue={(v<string[]>("languages", profile.languages ?? []) ?? []).join(", ")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="subject_strengths">Subject strengths (comma-separated)</label>
          <input className={inputCls} id="subject_strengths" name="subject_strengths" defaultValue={(v<string[]>("subject_strengths", profile.subject_strengths ?? []) ?? []).join(", ")} />
        </div>
        <fieldset>
          <legend className={labelCls}>Focus areas</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FOCUS_AREAS.map((area) => {
              const current = v<string[]>("focus_tags", profile.focus_tags ?? []) ?? [];
              return (
                <label key={area} className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" name="focus_areas" value={area} defaultChecked={current.includes(area)} className="rounded border-stone-300" />
                  {area}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="boarding" defaultChecked={Boolean(v("boarding", profile.boarding))} className="rounded border-stone-300" />
            Boarding available
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="homestay" defaultChecked={Boolean(v("homestay", profile.homestay))} className="rounded border-stone-300" />
            Homestay available
          </label>
        </div>
        <HostMonthsField defaultValue={v<string[]>("host_months", profile.host_months ?? []) ?? []} />
        <button className="rounded-lg bg-warm-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700">
          {live ? "Save changes" : "Submit changes for review"}
        </button>
      </form>
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
