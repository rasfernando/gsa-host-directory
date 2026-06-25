"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa } from "@/lib/notify";
import { logEvent } from "@/lib/events";

// Submits a GSA-led intake: creates/links the school, files a verification
// application carrying the template-specific answers, attaches it to the
// open cohort, and burns the invite token.
export async function submitIntake(formData: FormData) {
  const token = String(formData.get("token"));
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/onboard/${token}`)}`);

  const { data: inviteRows } = await supabase.rpc("intake_invite_by_token", {
    p_token: token,
  });
  const invite = Array.isArray(inviteRows) ? inviteRows[0] : inviteRows;
  if (!invite || invite.used_at) redirect(`/onboard/${token}`);

  // School: use the staff-created one if the invite carries it, else the
  // user's existing school, else create it now.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  // Role: dropdown value, or the free-text "Other" entry.
  const roleRaw = String(formData.get("contact_role") || formData.get("role_at_school") || "");
  const role = roleRaw === "Other" ? String(formData.get("contact_role_other") || "Other") : roleRaw;

  let schoolId = (invite.school_id as string | null) ?? profile?.school_id ?? null;
  if (!schoolId) {
    // Atomic create-and-link via RPC: a fresh user can't INSERT…RETURNING on
    // schools directly (the new row isn't visible to them until linked).
    const { data: newSchoolId, error: schoolError } = await supabase.rpc(
      "register_school",
      {
        p_name: String(formData.get("school_name") || invite.school_name),
        p_country: String(formData.get("country") || invite.country || ""),
        p_state: String(formData.get("state") || "") || null,
        p_city: String(formData.get("city") || "") || null,
        p_website: String(formData.get("website") || "") || null,
        p_contact_first_name: String(formData.get("contact_first_name") || "") || null,
        p_contact_last_name: String(formData.get("contact_last_name") || "") || null,
        p_contact_role: role || null,
        p_contact_email: user.email,
      }
    );
    if (schoolError || !newSchoolId)
      redirect(`/onboard/${token}?error=${encodeURIComponent(schoolError?.message ?? "Could not register your school")}`);
    schoolId = newSchoolId as string;
  }

  const composedName =
    [formData.get("contact_first_name"), formData.get("contact_last_name")]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join(" ") || undefined;

  if (profile?.school_id !== schoolId) {
    await supabase
      .from("user_profiles")
      .update({
        school_id: schoolId,
        full_name: composedName,
      })
      .eq("id", user.id);
  }

  // Attach to the soonest open verification cohort, if one exists.
  const { data: cohort } = await supabase
    .from("verification_cohorts")
    .select("id")
    .eq("status", "open")
    .gte("evidence_deadline", new Date().toISOString().slice(0, 10))
    .order("evidence_deadline", { ascending: true })
    .limit(1)
    .maybeSingle();

  const list = (k: string) =>
    String(formData.get(k) || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const num = (k: string) => (formData.get(k) ? Number(formData.get(k)) : null);

  const answers: Record<string, unknown> = {
    intake_template: invite.template,
    role_at_school: role,
    state: formData.get("state"),
    age_band: formData.get("age_band"),
    age_range_min: num("age_range_min"),
    age_range_max: num("age_range_max"),
    capacity: num("capacity"),
    languages: list("languages"),
    subject_strengths: formData.getAll("subject_strengths").map(String).filter(Boolean),
    boarding: formData.get("boarding") === "on",
    homestay: formData.get("homestay") === "on",
    hosted_before: formData.has("hosted_before")
      ? formData.get("hosted_before") === "yes"
      : null,
    host_months: formData.getAll("host_months").map(String).filter(Boolean),
    why_host: formData.get("why_host"),
    safeguarding_lead_name: formData.get("safeguarding_lead_name"),
    safeguarding_lead_email: formData.get("safeguarding_lead_email"),
    typical_hosting_windows: formData.get("typical_hosting_windows"),
  };
  if (invite.template === "gcc") {
    answers.gcc_delivery_windows = formData.get("gcc_delivery_windows");
    answers.gcc_residential = formData.get("gcc_residential") === "on";
    answers.gcc_excursion_access = formData.get("gcc_excursion_access");
  } else if (invite.template === "other") {
    answers.product_description = formData.get("product_description");
  } else {
    answers.hosting_experience = formData.get("hosting_experience");
  }

  const { error: appError } = await supabase.from("host_applications").insert({
    school_id: schoolId,
    status: "submitted",
    answers,
    cohort_id: cohort?.id ?? null,
    submitted_at: new Date().toISOString(),
  });
  if (appError) throw new Error(`Could not submit intake: ${appError.message}`);

  const { error: claimError } = await supabase.rpc("claim_intake_invite", {
    p_token: token,
    p_school: schoolId,
  });
  if (claimError) console.error("[intake] could not burn invite:", claimError.message);

  await logEvent("intake_submitted", {
    school_id: schoolId,
    meta: { template: invite.template, cohort_id: cohort?.id ?? null },
  });
  await notifyGsa(
    `GSA intake completed — ${invite.school_name}`,
    `<p><strong>${invite.school_name}</strong> has completed the ${invite.template} intake you invited them to.</p>
     <p>${cohort ? "Attached to the open verification cohort." : "No open cohort — assign one when the next window opens."}</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin">Open the review queue</a></p>`
  );
  redirect("/your-school?intake=submitted");
}
