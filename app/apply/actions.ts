"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa } from "@/lib/notify";
import { logEvent } from "@/lib/events";

// Creates the school (if first time), links it to the user,
// and submits the host application with form answers stored as JSON.
export async function submitApplication(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/apply");

  // Does this user already belong to a school?
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  let schoolId = profile?.school_id as string | null;

  if (!schoolId) {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .insert({
        name: String(formData.get("school_name")),
        country: String(formData.get("country")),
        city: String(formData.get("city") || ""),
        website: String(formData.get("website") || ""),
        contact_name: String(formData.get("contact_name")),
        contact_email: user.email,
      })
      .select("id")
      .single();

    if (schoolError) throw new Error(`Could not create school: ${schoolError.message}`);
    schoolId = school.id;

    const { error: linkError } = await supabase
      .from("user_profiles")
      .update({ school_id: schoolId, full_name: String(formData.get("contact_name")) })
      .eq("id", user.id);
    if (linkError) throw new Error(`Could not link school: ${linkError.message}`);
  }

  // Application answers — kept as JSON so the form can evolve
  // without database migrations while GSA finalises the standard.
  const answers = {
    role_at_school: formData.get("role_at_school"),
    age_range_min: Number(formData.get("age_range_min")),
    age_range_max: Number(formData.get("age_range_max")),
    capacity: Number(formData.get("capacity")),
    languages: String(formData.get("languages") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    subject_strengths: String(formData.get("subject_strengths") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    boarding: formData.get("boarding") === "on",
    homestay: formData.get("homestay") === "on",
    focus_areas: formData.getAll("focus_areas"),
    hosting_experience: formData.get("hosting_experience"),
    why_host: formData.get("why_host"),
    safeguarding_lead_name: formData.get("safeguarding_lead_name"),
    safeguarding_lead_email: formData.get("safeguarding_lead_email"),
    typical_hosting_windows: formData.get("typical_hosting_windows"),
  };

  const { error: appError } = await supabase.from("host_applications").insert({
    school_id: schoolId,
    status: "submitted",
    answers,
    submitted_at: new Date().toISOString(),
  });
  if (appError) throw new Error(`Could not submit application: ${appError.message}`);

  await logEvent("accreditation_applied", { school_id: schoolId });
  await notifyGsa(
    `New host application: ${formData.get("school_name") || "a school"}`,
    `<p><strong>${formData.get("school_name")}</strong> (${formData.get("country")}) has applied to become a GSA host school.</p>
     <p>Contact: ${formData.get("contact_name")} — ${user.email}</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin">Open the review queue</a></p>`
  );

  redirect("/apply/submitted");
}
