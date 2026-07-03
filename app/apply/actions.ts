"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa, escapeHtml } from "@/lib/notify";
import { logEvent } from "@/lib/events";
import { normalizeUrl } from "@/lib/forms";

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
    // Atomic create-and-link via RPC: a fresh user can't INSERT…RETURNING on
    // schools directly (the new row isn't visible to them until linked).
    const { data: newSchoolId, error: schoolError } = await supabase.rpc(
      "register_school",
      {
        p_name: String(formData.get("school_name")),
        p_country: String(formData.get("country")),
        p_city: String(formData.get("city") || "") || null,
        p_website: normalizeUrl(formData.get("website") as string),
        p_contact_name: String(formData.get("contact_name")),
        p_contact_email: user.email,
      }
    );
    if (schoolError || !newSchoolId)
      redirect(`/apply?error=${encodeURIComponent(schoolError?.message ?? "Could not register your school")}`);
    schoolId = newSchoolId as string;
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
    host_months: formData.getAll("host_months").map(String),
  };

  // Attach to the soonest open verification cohort so the evidence window
  // and batched checking apply automatically.
  const { data: cohort } = await supabase
    .from("verification_cohorts")
    .select("id")
    .eq("status", "open")
    .gte("evidence_deadline", new Date().toISOString().slice(0, 10))
    .order("evidence_deadline", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error: appError } = await supabase.from("host_applications").insert({
    school_id: schoolId,
    status: "submitted",
    answers,
    cohort_id: cohort?.id ?? null,
    submitted_at: new Date().toISOString(),
  });
  if (appError) throw new Error(`Could not submit application: ${appError.message}`);

  await logEvent("accreditation_applied", { school_id: schoolId });
  await notifyGsa(
    `New host application: ${escapeHtml(formData.get("school_name") || "a school")}`,
    `<p><strong>${escapeHtml(formData.get("school_name"))}</strong> (${escapeHtml(formData.get("country"))}) has applied to become a GSA host school.</p>
     <p>Contact: ${escapeHtml(formData.get("contact_name"))} — ${escapeHtml(user.email)}</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin">Open the review queue</a></p>`
  );

  redirect("/apply/submitted");
}
