"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa } from "@/lib/notify";
import { logEvent } from "@/lib/events";

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

  if (!schoolId) {
    // Atomic create-and-link via RPC: a fresh user can't INSERT…RETURNING on
    // schools directly (the new row isn't visible to them until linked).
    const { data: newSchoolId, error: schoolError } = await supabase.rpc(
      "register_school",
      {
        p_name: schoolName,
        p_country: String(formData.get("country")),
        p_city: String(formData.get("city") || "") || null,
        p_website: String(formData.get("website") || "") || null,
        p_contact_name: String(formData.get("contact_name")),
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
      country: String(formData.get("country")),
      city: String(formData.get("city") || ""),
      languages: String(formData.get("languages") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      age_range_min: formData.get("age_range_min") ? Number(formData.get("age_range_min")) : null,
      age_range_max: formData.get("age_range_max") ? Number(formData.get("age_range_max")) : null,
      boarding: formData.get("boarding") === "on",
      homestay: formData.get("homestay") === "on",
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
      typical_hosting_windows: String(formData.get("typical_hosting_windows") || "") || null,
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
