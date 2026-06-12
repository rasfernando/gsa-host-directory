"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { sendEmail } from "@/lib/notify";

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

function fail(message: string): never {
  redirect(`/admin/supply?error=${encodeURIComponent(message)}`);
}

// ── Verification cohorts (batched evidence windows) ─────────────────────────
export async function createCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("verification_cohorts").insert({
    name: String(formData.get("name") || "").trim() || "Verification cohort",
    evidence_deadline: String(formData.get("evidence_deadline")),
    decision_by: String(formData.get("decision_by") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  });
  if (error) fail(error.message);
  await logEvent("cohort_created");
  redirect("/admin/supply?saved=cohort");
}

export async function setCohortStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const status = String(formData.get("status"));
  if (!["open", "closed", "decided"].includes(status)) redirect("/admin/supply");
  const { error } = await supabase
    .from("verification_cohorts")
    .update({ status })
    .eq("id", String(formData.get("cohort_id")));
  if (error) fail(error.message);
  redirect("/admin/supply?saved=cohort");
}

// ── GSA intake invites (private links, product-specific templates) ──────────
export async function createIntakeInvite(formData: FormData) {
  const { supabase } = await requireAdmin();

  const contactEmail = String(formData.get("contact_email") || "").trim();
  const { data: invite, error } = await supabase
    .from("intake_invites")
    .insert({
      template: String(formData.get("template") || "standard"),
      school_name: String(formData.get("school_name") || "").trim(),
      contact_name: String(formData.get("contact_name") || "") || null,
      contact_email: contactEmail || null,
      country: String(formData.get("country") || "") || null,
      message: String(formData.get("message") || "") || null,
      school_id: String(formData.get("school_id") || "") || null,
    })
    .select("token, school_name")
    .single();
  if (error || !invite) fail(error?.message ?? "Could not create invite");

  await logEvent("intake_invite_created", { meta: { template: formData.get("template") } });
  if (contactEmail) {
    await sendEmail(
      contactEmail,
      `GSA has invited ${invite.school_name} to join as a host school`,
      `<p>The Global School Alliance would like ${invite.school_name} on the platform.</p>
       <p>Use your private link to tell us about your school — it takes about ten minutes:</p>
       <p><a href="https://gsa-host-directory.vercel.app/onboard/${invite.token}">Complete your school's intake</a></p>`
    );
  }
  redirect("/admin/supply?saved=invite");
}

// ── Staff-create-school: pre-fill for AIP schools and known upcoming trips ──
export async function staffCreateSchool(formData: FormData) {
  const { supabase } = await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const country = String(formData.get("country") || "").trim();
  if (!name || !country) fail("School name and country are required");

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .insert({
      name,
      country,
      city: String(formData.get("city") || "") || null,
      website: String(formData.get("website") || "") || null,
      contact_name: String(formData.get("contact_name") || "") || null,
      contact_email: String(formData.get("contact_email") || "") || null,
    })
    .select("id")
    .single();
  if (schoolError || !school) fail(schoolError?.message ?? "Could not create school");

  // Skeleton profile: GSA does the bones, the school fleshes it out.
  // Starts 'listed' and unpublished — the publication gate keeps it private
  // until verification.
  const slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
    `-${school.id.slice(0, 4)}`;
  const { error: profileError } = await supabase.from("host_profiles").insert({
    school_id: school.id,
    name,
    slug,
    tier: "listed",
    published: false,
    country,
    city: String(formData.get("city") || "") || null,
    headline: String(formData.get("headline") || "") || null,
  });
  if (profileError) fail(profileError.message);

  await logEvent("school_staff_created", { school_id: school.id });

  // Optionally hand straight over to the school with an intake invite.
  if (formData.get("send_invite") === "on") {
    const contactEmail = String(formData.get("contact_email") || "").trim();
    const { data: invite } = await supabase
      .from("intake_invites")
      .insert({
        template: String(formData.get("template") || "standard"),
        school_name: name,
        contact_name: String(formData.get("contact_name") || "") || null,
        contact_email: contactEmail || null,
        country,
        school_id: school.id,
      })
      .select("token")
      .single();
    if (invite && contactEmail) {
      await sendEmail(
        contactEmail,
        `GSA has started a profile for ${name} — complete it here`,
        `<p>We've set up the skeleton of ${name}'s host profile on the Global School Alliance platform. Flesh it out with your private link:</p>
         <p><a href="https://gsa-host-directory.vercel.app/onboard/${invite.token}">Complete your school's profile</a></p>`
      );
    }
  }
  redirect("/admin/supply?saved=school");
}
