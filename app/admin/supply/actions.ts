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

// ── Soft-launch mode (Workstream C) ─────────────────────────────────────────
export async function setLaunchSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const mode = String(formData.get("launch_mode"));
  const showcase = String(formData.get("showcase_slug") || "").trim();
  if (!["public", "onboarding"].includes(mode)) fail("Invalid launch mode");

  const { error } = await supabase.from("app_settings").upsert(
    [
      { key: "launch_mode", value: mode },
      { key: "showcase_slug", value: showcase },
    ],
    { onConflict: "key" }
  );
  if (error) fail(error.message);
  await logEvent("launch_mode_set", { meta: { mode, showcase } });
  redirect("/admin/supply?saved=launch");
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
// Creating an invite NEVER emails the school. The link is generated and held;
// Heather sends it per-school from the list once a school confirms it wants in
// (Spec v3.1 #9 — nothing reaches a school without explicit GSA action).
export async function createIntakeInvite(formData: FormData) {
  const { supabase } = await requireAdmin();

  const contactEmail = String(formData.get("contact_email") || "").trim();
  const { error } = await supabase
    .from("intake_invites")
    .insert({
      template: String(formData.get("template") || "standard"),
      school_name: String(formData.get("school_name") || "").trim(),
      contact_name: String(formData.get("contact_name") || "") || null,
      contact_email: contactEmail || null,
      country: String(formData.get("country") || "") || null,
      message: String(formData.get("message") || "") || null,
      school_id: String(formData.get("school_id") || "") || null,
    });
  if (error) fail(error.message);

  await logEvent("intake_invite_created", { meta: { template: formData.get("template") } });
  redirect("/admin/supply?saved=invite");
}

// Send (or resend) an invite to its contact email and mark it as invited.
export async function sendIntakeInvite(formData: FormData) {
  const { supabase } = await requireAdmin();
  const inviteId = String(formData.get("invite_id"));

  const { data: invite } = await supabase
    .from("intake_invites")
    .select("token, school_name, contact_email")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) fail("Invite not found");
  if (!invite.contact_email)
    fail("This school has no contact email yet — add one before sending.");

  await sendEmail(
    invite.contact_email,
    `GSA has invited ${invite.school_name} to join as a host school`,
    `<p>The Global School Alliance would like ${invite.school_name} on the platform.</p>
     <p>Use your private link to tell us about your school — it takes about ten minutes:</p>
     <p><a href="https://gsa-host-directory.vercel.app/onboard/${invite.token}">Complete your school's intake</a></p>`
  );
  await supabase
    .from("intake_invites")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", inviteId);
  await logEvent("intake_invite_sent", { meta: { invite_id: inviteId } });
  redirect("/admin/supply?saved=invitesent");
}

// ── Agents (commission resale) ──────────────────────────────────────────────
// The person must have signed in once (magic link) so an auth user exists;
// we then promote their profile and create the agency record.
export async function createAgent(formData: FormData) {
  const { supabase } = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .ilike("email", email)
    .maybeSingle();
  if (!profile)
    fail(`No account for ${email} yet — ask them to sign in once first, then add them.`);
  if (profile.role === "gsa_admin") fail("That account is a GSA admin.");

  const { error: roleError } = await supabase
    .from("user_profiles")
    .update({ role: "agent" })
    .eq("id", profile.id);
  if (roleError) fail(roleError.message);

  const { error } = await supabase.from("agents").upsert({
    id: profile.id,
    agency_name: String(formData.get("agency_name") || "").trim() || email,
    country: String(formData.get("country") || "") || null,
    contact_email: email,
    commission_bps: Math.round(Number(formData.get("commission_pct") || 10) * 100),
    status: "active",
  });
  if (error) fail(error.message);

  await logEvent("agent_created", { meta: { agent_id: profile.id } });
  redirect("/admin/supply?saved=agent");
}

export async function setAgentStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const status = String(formData.get("status"));
  if (!["active", "suspended"].includes(status)) redirect("/admin/supply");
  const { error } = await supabase
    .from("agents")
    .update({ status })
    .eq("id", String(formData.get("agent_id")));
  if (error) fail(error.message);
  redirect("/admin/supply?saved=agent");
}

export async function markCommissionPaid(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("agent_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", String(formData.get("commission_id")))
    .eq("status", "payable");
  if (error) fail(error.message);
  await logEvent("agent_commission_paid", {
    meta: { commission_id: formData.get("commission_id") },
  });
  redirect("/admin/supply?saved=commission");
}

export async function createBlockBooking(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("block_bookings").insert({
    agent_id: String(formData.get("agent_id")),
    host_profile_id: String(formData.get("host_profile_id")),
    window_start: String(formData.get("window_start")),
    window_end: String(formData.get("window_end")),
    places: Number(formData.get("places") || 10),
    notes: String(formData.get("notes") || "") || null,
  });
  if (error) fail(error.message);
  await logEvent("block_booking_created");
  redirect("/admin/supply?saved=block");
}

export async function releaseBlockBooking(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("block_bookings")
    .update({ status: "released" })
    .eq("id", String(formData.get("block_id")));
  if (error) fail(error.message);
  redirect("/admin/supply?saved=block");
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

  // Prepare an intake invite (held, not sent). Heather sends it from the
  // invite list once the school confirms it wants to be on the platform.
  if (formData.get("prepare_invite") === "on") {
    await supabase.from("intake_invites").insert({
      template: String(formData.get("template") || "standard"),
      school_name: name,
      contact_name: String(formData.get("contact_name") || "") || null,
      contact_email: String(formData.get("contact_email") || "") || null,
      country,
      school_id: school.id,
    });
  }
  redirect("/admin/supply?saved=school");
}
