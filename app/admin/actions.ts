"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  // Profile starts unpublished — GSA publishes once content is complete
  const { error: profileError } = await supabase.from("host_profiles").insert({
    school_id: app.school_id,
    name: school?.name ?? "",
    slug: `${slug}-${applicationId.slice(0, 4)}`,
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
  });
  if (profileError) throw new Error(profileError.message);

  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
}

// Publish / unpublish a directory profile
export async function togglePublish(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const publish = formData.get("publish") === "true";

  const { error } = await supabase
    .from("host_profiles")
    .update({ published: publish })
    .eq("id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/profiles");
  revalidatePath("/directory");
}

// Update enquiry status / notes
export async function updateEnquiry(formData: FormData) {
  const { supabase } = await requireAdmin();
  const enquiryId = String(formData.get("enquiry_id"));

  const { error } = await supabase
    .from("enquiries")
    .update({
      status: String(formData.get("status")),
      gsa_notes: String(formData.get("gsa_notes") || ""),
    })
    .eq("id", enquiryId);
  if (error) throw new Error(error.message);

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
