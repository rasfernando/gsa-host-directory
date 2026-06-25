"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa } from "@/lib/notify";
import { logEvent } from "@/lib/events";
import { normalizeUrl } from "@/lib/forms";

// Tier 1 self-serve listing: creates the school and an unpublished "listed"
// profile in one step. GSA does a light sanity check (real school, real
// person) and publishes from the admin Profiles tab — no full accreditation
// checklist required at this tier.
export async function submitListing(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/list-your-school");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  let schoolId = profile?.school_id as string | null;
  const schoolName = String(formData.get("school_name"));

  // Role: dropdown value, or the free-text "Other" entry.
  const roleRaw = String(formData.get("contact_role") || "");
  const role = roleRaw === "Other" ? String(formData.get("contact_role_other") || "Other") : roleRaw;

  if (!schoolId) {
    // Atomic create-and-link via RPC: a fresh user can't INSERT…RETURNING on
    // schools directly (the new row isn't visible to them until linked).
    const { data: newSchoolId, error: schoolError } = await supabase.rpc(
      "register_school",
      {
        p_name: schoolName,
        p_country: String(formData.get("country")),
        p_state: String(formData.get("state") || "") || null,
        p_city: String(formData.get("city") || "") || null,
        p_website: normalizeUrl(String(formData.get("website") || "")),
        p_contact_first_name: String(formData.get("contact_first_name") || "") || null,
        p_contact_last_name: String(formData.get("contact_last_name") || "") || null,
        p_contact_role: role || null,
        p_contact_email: user.email,
      }
    );
    if (schoolError || !newSchoolId)
      redirect(`/list-your-school?error=${encodeURIComponent(schoolError?.message ?? "Could not register your school")}`);
    schoolId = newSchoolId as string;
  }

  const slug =
    schoolName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6);

  // Optional cover photo → public school-media bucket, path scoped to the school
  let media: { url: string; type: string }[] = [];
  const photo = formData.get("photo") as File | null;
  if (photo && photo.size > 0 && photo.size <= 5 * 1024 * 1024) {
    const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${schoolId}/cover-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("school-media")
      .upload(path, photo, { contentType: photo.type });
    if (!uploadError) {
      const { data: pub } = supabase.storage.from("school-media").getPublicUrl(path);
      media = [{ url: pub.publicUrl, type: "image" }];
    }
  }

  const { data: newProfile, error: profileError } = await supabase
    .from("host_profiles")
    .insert({
      media,
      school_id: schoolId,
      name: schoolName,
      slug,
      tier: "listed",
      published: false,
      headline: String(formData.get("headline") || ""),
      why_host: String(formData.get("why_host") || "") || null,
      country: String(formData.get("country")),
      state: String(formData.get("state") || "") || null,
      city: String(formData.get("city") || ""),
      languages: formData.getAll("languages").map(String).filter(Boolean),
      subject_strengths: formData.getAll("subject_strengths").map(String).filter(Boolean),
      age_band: String(formData.get("age_band") || "") || null,
      age_range_min: formData.get("age_range_min") ? Number(formData.get("age_range_min")) : null,
      age_range_max: formData.get("age_range_max") ? Number(formData.get("age_range_max")) : null,
      boarding: formData.get("boarding") === "on",
      homestay: formData.get("homestay") === "on",
      hosted_before: formData.has("hosted_before")
        ? formData.get("hosted_before") === "yes"
        : null,
      host_months: formData.getAll("host_months").map(String).filter(Boolean),
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
    })
    .select("id")
    .single();
  if (profileError) {
    throw new Error(
      profileError.code === "23505"
        ? "Your school already has a listing."
        : `Could not create listing: ${profileError.message}`
    );
  }

  await logEvent("listing_created", { school_id: schoolId, profile_id: newProfile.id });
  await notifyGsa(
    `New host listing: ${schoolName}`,
    `<p><strong>${schoolName}</strong> (${formData.get("country")}) has listed as a host school (Tier 1 — needs a quick review before publishing).</p>
     <p>Contact: ${formData.get("contact_name")} — ${user.email}</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/profiles">Review listings</a></p>`
  );

  redirect("/list-your-school/submitted");
}
