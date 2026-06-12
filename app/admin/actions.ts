"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { sendEmail } from "@/lib/notify";
import { geocodeSchool } from "@/lib/geocode";

// Pin a profile to the map (no-op without GOOGLE_PLACES_API_KEY).
async function geocodeProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
) {
  const { data: p } = await supabase
    .from("host_profiles")
    .select("id, name, city, country, lat")
    .eq("id", profileId)
    .single();
  if (!p || p.lat != null) return;
  const coords = await geocodeSchool({ name: p.name, city: p.city, country: p.country });
  if (coords) {
    await supabase
      .from("host_profiles")
      .update({ lat: coords.lat, lng: coords.lng })
      .eq("id", profileId);
  }
}

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

  // Three-tier model: approving the evidence checks makes a school VERIFIED
  // (publishable). Accredited is a separate promotion (licence agreement,
  // catalog placement) — never granted automatically, and never taken away
  // here if the school already holds it.
  const { data: existing } = await supabase
    .from("host_profiles")
    .select("tier")
    .eq("school_id", app.school_id)
    .maybeSingle();
  const tier = existing?.tier === "accredited" ? "accredited" : "verified";

  // Upsert: a school upgrading from a Tier 1 listing keeps its existing
  // profile (and slug); a school applying directly gets a new one.
  // Publishing stays manual.
  const { data: upserted, error: profileError } = await supabase
    .from("host_profiles")
    .upsert(
      {
        school_id: app.school_id,
        name: school?.name ?? "",
        slug: `${slug}-${applicationId.slice(0, 4)}`,
        tier,
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
  // The DB gate blocks publishing unverified schools — surface that nicely.
  if (error) redirect(`/admin/profiles?error=${encodeURIComponent(error.message)}`);

  if (publish) {
    await logEvent("profile_published", {
      school_id: updated?.school_id,
      profile_id: profileId,
    });
    await geocodeProfile(supabase, profileId);
  }

  revalidatePath("/admin/profiles");
  revalidatePath("/directory");
}

// First review of a listed school: GSA checks it out, marks it verified and
// puts it live in one step. (The DB gate requires tier before published —
// done as two updates in order.)
export async function verifyAndPublish(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));

  const { error: tierError } = await supabase
    .from("host_profiles")
    .update({ tier: "verified" })
    .eq("id", profileId)
    .eq("tier", "listed");
  if (tierError) redirect(`/admin/profiles?error=${encodeURIComponent(tierError.message)}`);

  const { data: updated, error } = await supabase
    .from("host_profiles")
    .update({ published: true })
    .eq("id", profileId)
    .select("school_id")
    .single();
  if (error) redirect(`/admin/profiles?error=${encodeURIComponent(error.message)}`);

  await logEvent("profile_published", {
    school_id: updated?.school_id,
    profile_id: profileId,
  });
  await geocodeProfile(supabase, profileId);
  revalidatePath("/admin/profiles");
  revalidatePath("/directory");
}

// Backfill: geocode every published profile that isn't on the map yet.
export async function geocodeAllProfiles() {
  const { supabase } = await requireAdmin();
  const { data: missing } = await supabase
    .from("host_profiles")
    .select("id, name, city, country")
    .eq("published", true)
    .is("lat", null);

  let done = 0;
  for (const p of missing ?? []) {
    const coords = await geocodeSchool({ name: p.name, city: p.city, country: p.country });
    if (coords) {
      await supabase
        .from("host_profiles")
        .update({ lat: coords.lat, lng: coords.lng })
        .eq("id", p.id);
      done++;
    }
  }
  await logEvent("profiles_geocoded", { meta: { geocoded: done, missing: (missing ?? []).length } });
  revalidatePath("/admin/profiles");
  revalidatePath("/directory");
  redirect(`/admin/profiles?geocoded=${done}&of=${(missing ?? []).length}`);
}

// Move a profile between supply tiers. Verified ↔ accredited only — dropping
// below verified would conflict with the publication gate while live.
export async function setProfileTier(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const tier = String(formData.get("tier"));
  if (!["verified", "accredited"].includes(tier)) redirect("/admin/profiles");

  const { error } = await supabase
    .from("host_profiles")
    .update({
      tier,
      accredited_at: tier === "accredited" ? new Date().toISOString() : null,
    })
    .eq("id", profileId);
  if (error) redirect(`/admin/profiles?error=${encodeURIComponent(error.message)}`);

  await logEvent(tier === "accredited" ? "profile_accredited" : "profile_set_verified", {
    profile_id: profileId,
  });
  revalidatePath("/admin/profiles");
  revalidatePath("/directory");
  redirect("/admin/profiles");
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

// Ask the school for more information: sets the application to info_requested,
// records the ask, and reopens editing for the school.
export async function requestMoreInfo(formData: FormData) {
  const { supabase } = await requireAdmin();
  const applicationId = String(formData.get("application_id"));
  const note = String(formData.get("info_request") || "").trim();
  if (!note) throw new Error("A note describing what you need is required.");

  const { data: updated, error } = await supabase
    .from("host_applications")
    .update({
      status: "info_requested",
      info_request: note,
      info_requested_at: new Date().toISOString(),
      info_responded_at: null,
    })
    .eq("id", applicationId)
    .select("school_id, schools(name, contact_email)")
    .single();
  if (error) throw new Error(error.message);

  const school = Array.isArray(updated?.schools)
    ? updated?.schools[0]
    : updated?.schools;

  await logEvent("info_requested", { school_id: updated?.school_id });
  // Best-effort: free-tier Resend may only deliver to the account owner until a
  // sending domain is verified. The in-portal banner is the reliable channel.
  await sendEmail(
    school?.contact_email ?? undefined,
    `GSA needs a little more information — ${school?.name ?? "your application"}`,
    `<p>The GSA team has reviewed your accreditation application and needs a bit more from you:</p>
     <blockquote>${note}</blockquote>
     <p>Please respond here: <a href="https://gsa-host-directory.vercel.app/your-school/application">your application</a>.</p>`
  );

  revalidatePath("/admin");
  revalidatePath(`/admin/applications/${applicationId}`);
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
