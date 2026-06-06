"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa } from "@/lib/notify";
import { logEvent } from "@/lib/events";

export type MediaItem = { url: string; type?: string; [k: string]: unknown };

// Fields a school may edit on its own listing/profile.
type EditableFields = {
  headline: string | null;
  description: string | null;
  city: string | null;
  languages: string[];
  age_range_min: number | null;
  age_range_max: number | null;
  subject_strengths: string[];
  focus_tags: string[];
  boarding: boolean;
  homestay: boolean;
  capacity: number | null;
  typical_hosting_windows: string | null;
};

async function requireSchool() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/your-school");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!profile?.school_id) redirect("/your-school");
  return { supabase, user, schoolId: profile.school_id as string };
}

function parseList(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readEditableFields(formData: FormData): EditableFields {
  const num = (k: string) =>
    formData.get(k) ? Number(formData.get(k)) : null;
  return {
    headline: String(formData.get("headline") || "") || null,
    description: String(formData.get("description") || "") || null,
    city: String(formData.get("city") || "") || null,
    languages: parseList(formData.get("languages")),
    age_range_min: num("age_range_min"),
    age_range_max: num("age_range_max"),
    subject_strengths: parseList(formData.get("subject_strengths")),
    focus_tags: formData.getAll("focus_areas").map(String).filter(Boolean),
    boarding: formData.get("boarding") === "on",
    homestay: formData.get("homestay") === "on",
    capacity: num("capacity"),
    typical_hosting_windows:
      String(formData.get("typical_hosting_windows") || "") || null,
  };
}

async function loadOwnProfile() {
  const { supabase, schoolId } = await requireSchool();
  const { data: profile } = await supabase
    .from("host_profiles")
    .select("id, name, published, media, pending_changes")
    .eq("school_id", schoolId)
    .single();
  return { supabase, schoolId, profile };
}

// ── Contact details ────────────────────────────────────────────────────────
// Always allowed (not a directory-visible, verified field).
export async function updateContact(formData: FormData) {
  const { supabase, schoolId } = await requireSchool();
  const { error } = await supabase
    .from("schools")
    .update({
      contact_name: String(formData.get("contact_name") || ""),
      contact_email: String(formData.get("contact_email") || ""),
      website: String(formData.get("website") || ""),
    })
    .eq("id", schoolId);
  if (error) throw new Error(`Could not update contact: ${error.message}`);
  revalidatePath("/your-school");
  redirect("/your-school?saved=contact");
}

// ── Listing fields ─────────────────────────────────────────────────────────
// Unpublished → applies directly. Published → queues for re-approval.
export async function updateListing(formData: FormData) {
  const { supabase, profile } = await loadOwnProfile();
  if (!profile) redirect("/your-school");

  const fields = readEditableFields(formData);

  if (!profile.published) {
    const { error } = await supabase
      .from("host_profiles")
      .update(fields)
      .eq("id", profile.id);
    if (error) throw new Error(`Could not save: ${error.message}`);
    await logEvent("listing_edited", { profile_id: profile.id });
    redirect("/your-school/listing?saved=1");
  }

  // Published: stage the change. Keep any already-staged media.
  const staged = (profile.pending_changes as Record<string, unknown>) ?? {};
  const pending = {
    ...fields,
    media: (staged.media as MediaItem[]) ?? (profile.media as MediaItem[]) ?? [],
  };
  const { error } = await supabase
    .from("host_profiles")
    .update({ pending_changes: pending, pending_review: true })
    .eq("id", profile.id);
  if (error) throw new Error(`Could not submit changes: ${error.message}`);

  await logEvent("profile_changes_submitted", { profile_id: profile.id });
  await notifyGsa(
    `Profile changes to review: ${profile.name}`,
    `<p><strong>${profile.name}</strong> has submitted changes to its live profile. They are held for re-approval and not yet public.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/profiles">Review changes</a></p>`
  );
  redirect("/your-school/listing?staged=1");
}

// ── Photos ─────────────────────────────────────────────────────────────────
// Returns the media array a school is currently editing: the staged set if the
// profile is published (changes pending re-approval), else the live set.
function workingMedia(profile: {
  published: boolean;
  media: unknown;
  pending_changes: unknown;
}): MediaItem[] {
  if (profile.published) {
    const staged = (profile.pending_changes as Record<string, unknown>) ?? {};
    return ((staged.media as MediaItem[]) ?? (profile.media as MediaItem[]) ?? []).slice();
  }
  return ((profile.media as MediaItem[]) ?? []).slice();
}

async function saveMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; published: boolean; pending_changes: unknown },
  media: MediaItem[]
) {
  if (!profile.published) {
    const { error } = await supabase
      .from("host_profiles")
      .update({ media })
      .eq("id", profile.id);
    if (error) throw new Error(error.message);
    return { staged: false };
  }
  const staged = (profile.pending_changes as Record<string, unknown>) ?? {};
  const { error } = await supabase
    .from("host_profiles")
    .update({ pending_changes: { ...staged, media }, pending_review: true })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);
  await notifyGsa(
    `Profile photo change to review`,
    `<p>A school updated its photos. Held for re-approval before going public.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/profiles">Review changes</a></p>`
  );
  return { staged: true };
}

const MAX_PHOTOS = 8;

export async function addPhoto(formData: FormData) {
  const { supabase, schoolId, profile } = await loadOwnProfile();
  if (!profile) redirect("/your-school");

  const photo = formData.get("photo") as File | null;
  if (!photo || photo.size === 0) redirect("/your-school/listing?error=nophoto");
  if (photo.size > 5 * 1024 * 1024)
    redirect("/your-school/listing?error=toobig");
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
    redirect("/your-school/listing?error=type");

  const media = workingMedia(profile);
  if (media.length >= MAX_PHOTOS)
    redirect("/your-school/listing?error=max");

  const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${schoolId}/photo-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("school-media")
    .upload(path, photo, { contentType: photo.type });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: pub } = supabase.storage.from("school-media").getPublicUrl(path);
  media.push({ url: pub.publicUrl, type: "image" });
  const { staged } = await saveMedia(supabase, profile, media);
  await logEvent("photo_added", { profile_id: profile.id });
  redirect(`/your-school/listing?${staged ? "staged=1" : "saved=1"}`);
}

export async function setCover(formData: FormData) {
  const { supabase, profile } = await loadOwnProfile();
  if (!profile) redirect("/your-school");
  const index = Number(formData.get("index"));
  const media = workingMedia(profile);
  if (Number.isInteger(index) && index > 0 && index < media.length) {
    const [chosen] = media.splice(index, 1);
    media.unshift(chosen);
    const { staged } = await saveMedia(supabase, profile, media);
    redirect(`/your-school/listing?${staged ? "staged=1" : "saved=1"}`);
  }
  redirect("/your-school/listing");
}

export async function removePhoto(formData: FormData) {
  const { supabase, profile } = await loadOwnProfile();
  if (!profile) redirect("/your-school");
  const index = Number(formData.get("index"));
  const media = workingMedia(profile);
  if (!Number.isInteger(index) || index < 0 || index >= media.length)
    redirect("/your-school/listing");

  const [removed] = media.splice(index, 1);

  // On an unpublished profile the change is immediate, so delete the file now.
  // On a published profile the removal is only *staged*; the live profile still
  // shows the photo, so the file is deleted later, when an admin approves.
  if (!profile.published && removed?.url) {
    const path = removed.url.split("/school-media/")[1];
    if (path) await supabase.storage.from("school-media").remove([path]);
  }

  const { staged } = await saveMedia(supabase, profile, media);
  redirect(`/your-school/listing?${staged ? "staged=1" : "saved=1"}`);
}

// ── Accreditation application (editable until GSA decides) ──────────────────
export async function updateApplication(formData: FormData) {
  const { supabase, schoolId } = await requireSchool();

  const { data: app } = await supabase
    .from("host_applications")
    .select("id, status")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!app || !["draft", "submitted", "under_review"].includes(app.status)) {
    redirect("/your-school");
  }

  const num = (k: string) => (formData.get(k) ? Number(formData.get(k)) : null);
  const answers = {
    role_at_school: formData.get("role_at_school"),
    age_range_min: num("age_range_min"),
    age_range_max: num("age_range_max"),
    capacity: num("capacity"),
    languages: parseList(formData.get("languages")),
    subject_strengths: parseList(formData.get("subject_strengths")),
    boarding: formData.get("boarding") === "on",
    homestay: formData.get("homestay") === "on",
    focus_areas: formData.getAll("focus_areas").map(String),
    hosting_experience: formData.get("hosting_experience"),
    why_host: formData.get("why_host"),
    safeguarding_lead_name: formData.get("safeguarding_lead_name"),
    safeguarding_lead_email: formData.get("safeguarding_lead_email"),
    typical_hosting_windows: formData.get("typical_hosting_windows"),
  };

  const { error } = await supabase
    .from("host_applications")
    .update({ answers })
    .eq("id", app.id);
  if (error) throw new Error(`Could not update application: ${error.message}`);

  await logEvent("application_edited", { school_id: schoolId });
  redirect("/your-school/application?saved=1");
}
