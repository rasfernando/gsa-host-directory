"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Availability windows and the internal notes log on a host profile.
// Both tables come from supabase/migrations/20261027_directory_v1.sql and are
// GSA-admin-only under RLS.

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

function back(profileId: string, flag: "saved" | "error", value = "1"): never {
  redirect(`/admin/profiles/${profileId}/edit?${flag}=${encodeURIComponent(value)}#availability`);
}

export async function addAvailability(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const startsOn = String(formData.get("starts_on") || "");
  const endsOn = String(formData.get("ends_on") || "") || startsOn;
  if (!startsOn) back(profileId, "error", "A start date is required");
  if (endsOn < startsOn) back(profileId, "error", "End date is before the start date");
  const status = formData.get("status") === "reserved" ? "reserved" : "available";

  const { error } = await supabase.from("host_availability").insert({
    host_profile_id: profileId,
    starts_on: startsOn,
    ends_on: endsOn,
    status,
    reserved_for: status === "reserved" ? String(formData.get("reserved_for") || "").trim() || null : null,
    note: String(formData.get("note") || "").trim() || null,
    created_by: user.id,
  });
  if (error) back(profileId, "error", error.message);
  revalidatePath(`/admin/profiles/${profileId}/edit`);
  revalidatePath("/admin/profiles");
  back(profileId, "saved", "availability");
}

export async function setAvailabilityStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const id = String(formData.get("id"));
  const status = formData.get("status") === "reserved" ? "reserved" : "available";
  const { error } = await supabase
    .from("host_availability")
    .update({
      status,
      reserved_for: status === "reserved" ? String(formData.get("reserved_for") || "").trim() || null : null,
    })
    .eq("id", id);
  if (error) back(profileId, "error", error.message);
  revalidatePath(`/admin/profiles/${profileId}/edit`);
  revalidatePath("/admin/profiles");
  back(profileId, "saved", "availability");
}

export async function deleteAvailability(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const { error } = await supabase.from("host_availability").delete().eq("id", String(formData.get("id")));
  if (error) back(profileId, "error", error.message);
  revalidatePath(`/admin/profiles/${profileId}/edit`);
  revalidatePath("/admin/profiles");
  back(profileId, "saved", "availability");
}

export async function addNote(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const body = String(formData.get("body") || "").trim();
  if (!body) back(profileId, "error", "Write something first");
  const { error } = await supabase
    .from("host_notes")
    .insert({ host_profile_id: profileId, body, created_by: user.id });
  if (error) back(profileId, "error", error.message);
  revalidatePath(`/admin/profiles/${profileId}/edit`);
  redirect(`/admin/profiles/${profileId}/edit?saved=note#notes`);
}

export async function deleteNote(formData: FormData) {
  const { supabase } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const { error } = await supabase.from("host_notes").delete().eq("id", String(formData.get("id")));
  if (error) back(profileId, "error", error.message);
  revalidatePath(`/admin/profiles/${profileId}/edit`);
  redirect(`/admin/profiles/${profileId}/edit?saved=note#notes`);
}

// ── Delete a school outright (Heather, 2 Nov 2026) ──────────────────────────
// Removes the profile, everything hanging off it, and — when nothing else
// points at it — the school record too, unlinking the person's login so they
// can register again from scratch. Uses the service role because several of
// these tables have no admin DELETE policy. Trips, invoices and payments are
// deliberately untouched: if one of those references the school the delete
// stops with an error rather than taking money history with it.
export async function deleteProfile(formData: FormData) {
  await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  if (!profileId) redirect("/admin/profiles?error=Missing%20profile");

  const service = createServiceClient();
  if (!service) redirect("/admin/profiles?error=" + encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY is not set, so profiles can't be deleted from here"));

  const { data: profile } = await service
    .from("host_profiles")
    .select("id, name, school_id")
    .eq("id", profileId)
    .single();
  if (!profile) redirect("/admin/profiles?error=" + encodeURIComponent("That profile no longer exists"));

  // Children of the profile. 42P01 = table not created yet; fine to skip.
  const ignorable = (code?: string) => code === "42P01";
  for (const table of ["host_notes", "host_availability", "block_bookings", "enquiries"]) {
    const { error } = await service.from(table).delete().eq("host_profile_id", profileId);
    if (error && !ignorable(error.code)) {
      redirect(`/admin/profiles?error=${encodeURIComponent(`Could not clear ${table}: ${error.message}`)}`);
    }
  }
  const { error: profileError } = await service.from("host_profiles").delete().eq("id", profileId);
  if (profileError) redirect(`/admin/profiles?error=${encodeURIComponent(profileError.message)}`);

  // The school itself, only if this was its last profile.
  if (profile.school_id) {
    const { count } = await service
      .from("host_profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", profile.school_id);
    if ((count ?? 0) === 0) {
      const { data: apps } = await service.from("host_applications").select("id").eq("school_id", profile.school_id);
      const appIds = (apps ?? []).map((a) => a.id as string);
      if (appIds.length > 0) {
        for (const table of ["verification_checks", "evidence"]) {
          const { error } = await service.from(table).delete().in("application_id", appIds);
          if (error && !ignorable(error.code) && error.code !== "42703") console.warn(`[delete ${table}] ${error.message}`);
        }
        await service.from("host_applications").delete().eq("school_id", profile.school_id);
      }
      const { error: invErr } = await service.from("intake_invites").delete().eq("school_id", profile.school_id);
      if (invErr && !ignorable(invErr.code)) console.warn(`[delete intake_invites] ${invErr.message}`);
      await service.from("user_profiles").update({ school_id: null }).eq("school_id", profile.school_id);
      const { error: schoolError } = await service.from("schools").delete().eq("id", profile.school_id);
      if (schoolError) {
        // Profile is gone but the school has other history (a trip, an invoice…).
        redirect(`/admin/profiles?error=${encodeURIComponent(`Profile deleted, but the school record was kept: ${schoolError.message}`)}`);
      }
    }
  }

  revalidatePath("/admin/profiles");
  redirect(`/admin/profiles?deleted=${encodeURIComponent(profile.name)}`);
}
