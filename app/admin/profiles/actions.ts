"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
