"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "gsa_admin") throw new Error("Not an admin");

  return { supabase, user };
}

// Record (or update) a single verification check result
export async function recordCheck(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const applicationId = String(formData.get("application_id"));
  const checkKey = String(formData.get("check_key"));
  const status = String(formData.get("status")); // passed | failed | waived | pending
  const notes = String(formData.get("notes") || "");

  const { error } = await supabase.from("verification_checks").upsert(
    {
      application_id: applicationId,
      check_key: checkKey,
      status,
      notes,
      checked_by: user.id,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "application_id,check_key" }
  );
  if (error) throw new Error(error.message);

  // First check recorded moves the application into review
  await supabase
    .from("host_applications")
    .update({ status: "under_review" })
    .eq("id", applicationId)
    .eq("status", "submitted");

  revalidatePath(`/admin/applications/${applicationId}`);
}

// Approve: mark application approved and create the (unpublished) directory profile
export async function approveApplication(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const applicationId = String(formData.get("application_id"));

  const { data: app, error: appError } = await supabase
    .from("host_applications")
    .select("id, school_id, answers, schools(name, country, city)")
    .eq("id", applicationId)
    .single();
  if (appError || !app) throw new Error(appError?.message ?? "Application not found");

  const { error: updateError } = await supabase
    .from("host_applications")
    .update({
      status: "approved",
      reviewed_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: String(formData.get("decision_notes") || ""),
    })
    .eq("id", applicationId);
  if (updateError) throw new Error(updateError.message);

  // Build the public verification summary: outcome + date only, never notes
  const { data: checks } = await supabase
    .from("verification_checks")
    .select("check_key, status, checked_at")
    .eq("application_id", applicationId);
  const verificationSummary = (checks ?? [])
    .filter((c) => ["passed", "waived"].includes(c.status))
    .map((c) => ({
      key: c.check_key,
      status: c.status,
      date: c.checked_at,
    }));

  const school = Array.isArray(app.schools) ? app.schools[0] : app.schools;
  const answers = (app.answers ?? {}) as Record<string, unknown>;
  const slug = (school?.name ?? "school")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Upsert: a school upgrading from a Tier 1 listing keeps its existing
  // profile (and slug); a school applying directly gets a new one.
  // Either way the profile becomes accredited. Publishing stays manual.
  const { data: upserted, error: profileError } = await supabase
    .from("host_profiles")
    .upsert(
      {
        school_id: app.school_id,
        name: school?.name ?? "",
        slug: `${slug}-${applicationId.slice(0, 4)}`,
        tier: "accredited",
        published: false,
        country: school?.country ?? "",
        city: school?.city ?? "",
        languages: (answers.languages as string[]) ?? [],
        age_range_min: (answers.age_range_min as number) ?? null,
        age_range_max: (answers.age_range_max as number) ?? null,
        subject_strengths: (answers.subject_strengths as string[]) ?? [],
        focus_tags: (answers.focus_areas as string[]) ?? [],
        boarding: Boolean(answers.boarding),
        homestay: Boolean(answers.homestay),
        capacity: (answers.capacity as number) ?? null,
        typical_hosting_windows: (answers.typical_hosting_windows as string) ?? null,
        verification_summary: verificationSummary,
        accredited_at: new Date().toISOString(),
      },
      { onConflict: "school_id" }
    )
    .select("id")
    .single();
  if (profileError) throw new Error(profileError.message);

  await logEvent("application_approved", {
    school_id: app.school_id,
    profile_id: upserted?.id,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
}

// Publish / unpublish a directory profile
export async function togglePublish(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const publish = formData.get("publish") === "true";

  const { data: updated, error } = await supabase
    .from("host_profiles")
    .update({ published: publish })
    .eq("id", profileId)
    .select("school_id")
    .single();
  if (error) throw new Error(error.message);

  if (publish) {
    await logEvent("profile_published", {
      school_id: updated?.school_id,
      profile_id: profileId,
    });
  }

  revalidatePath("/admin/profiles");
  revalidatePath("/directory");
}

// Approve a school's staged edits to a live profile: merge pending_changes
// into the live row, clean up any photos the school removed, and clear the flag.
export async function approvePendingChanges(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));

  const { data: profile, error: loadError } = await supabase
    .from("host_profiles")
    .select("id, media, pending_changes")
    .eq("id", profileId)
    .single();
  if (loadError || !profile) throw new Error(loadError?.message ?? "Not found");

  const pending = (profile.pending_changes as Record<string, unknown>) ?? {};
  const newMedia = (pending.media as { url: string }[]) ?? [];
  const oldMedia = (profile.media as { url: string }[]) ?? [];

  // Whitelist exactly the editable columns — never trust pending to carry
  // protected fields (published, tier, etc).
  const merged: Record<string, unknown> = {
    headline: pending.headline ?? null,
    description: pending.description ?? null,
    city: pending.city ?? null,
    languages: pending.languages ?? [],
    age_range_min: pending.age_range_min ?? null,
    age_range_max: pending.age_range_max ?? null,
    subject_strengths: pending.subject_strengths ?? [],
    focus_tags: pending.focus_tags ?? [],
    boarding: Boolean(pending.boarding),
    homestay: Boolean(pending.homestay),
    capacity: pending.capacity ?? null,
    typical_hosting_windows: pending.typical_hosting_windows ?? null,
    media: newMedia,
    pending_changes: null,
    pending_review: false,
  };

  const { error } = await supabase
    .from("host_profiles")
    .update(merged)
    .eq("id", profileId);
  if (error) throw new Error(error.message);

  // Delete storage objects for photos that were removed in this change.
  const newUrls = new Set(newMedia.map((m) => m.url));
  const orphanPaths = oldMedia
    .filter((m) => !newUrls.has(m.url))
    .map((m) => m.url.split("/school-media/")[1])
    .filter(Boolean) as string[];
  if (orphanPaths.length) {
    await supabase.storage.from("school-media").remove(orphanPaths);
  }

  await logEvent("profile_changes_approved", { profile_id: profileId });
  revalidatePath("/admin/profiles");
  revalidatePath("/directory");
}

// Discard a school's staged edits without applying them.
export async function discardPendingChanges(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const { error } = await supabase
    .from("host_profiles")
    .update({ pending_changes: null, pending_review: false })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/profiles");
}

// Update enquiry status / notes
export async function updateEnquiry(formData: FormData) {
  const { supabase } = await requireAdmin();
  const enquiryId = String(formData.get("enquiry_id"));

  const newStatus = String(formData.get("status"));
  const { data: updated, error } = await supabase
    .from("enquiries")
    .update({
      status: newStatus,
      gsa_notes: String(formData.get("gsa_notes") || ""),
    })
    .eq("id", enquiryId)
    .select("host_profile_id, status")
    .single();
  if (error) throw new Error(error.message);

  if (newStatus === "converted") {
    await logEvent("enquiry_converted", {
      profile_id: updated?.host_profile_id,
      meta: { enquiry_id: enquiryId },
    });
  }

  revalidatePath("/admin/enquiries");
}

// Reject with notes
export async function rejectApplication(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const applicationId = String(formData.get("application_id"));

  const { error } = await supabase
    .from("host_applications")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: String(formData.get("decision_notes") || ""),
    })
    .eq("id", applicationId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
}
