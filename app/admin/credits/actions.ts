"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";

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

// Manual credit adjustment: add or remove credits with a required note.
// Appends a ledger row — history is never edited.
export async function adjustCredits(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const schoolId = String(formData.get("school_id"));
  const delta = Math.trunc(Number(formData.get("delta")));
  const note = String(formData.get("note") || "").trim();

  if (!schoolId) redirect("/admin/credits?error=noschool");
  if (!Number.isFinite(delta) || delta === 0)
    redirect("/admin/credits?error=amount");
  if (!note) redirect("/admin/credits?error=note");

  const { error } = await supabase.from("credit_ledger").insert({
    school_id: schoolId,
    delta,
    reason: "admin_adjustment",
    note,
    created_by: user.id,
  });
  if (error) redirect(`/admin/credits?error=${encodeURIComponent(error.message)}`);

  await logEvent("credits_adjusted", {
    school_id: schoolId,
    meta: { delta, note },
  });
  revalidatePath("/admin/credits");
  redirect("/admin/credits?saved=1");
}

// Update a credit award value (app_settings) so GSA can retune without a deploy.
export async function updateCreditValue(formData: FormData) {
  const { supabase } = await requireAdmin();
  const key = String(formData.get("key"));
  const value = Math.trunc(Number(formData.get("value")));

  if (!/^credits_(profile_verified|booking|hosting|referral)$/.test(key))
    redirect("/admin/credits?error=badkey");
  if (!Number.isFinite(value) || value < 0)
    redirect("/admin/credits?error=amount");

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() });
  if (error) redirect(`/admin/credits?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/credits");
  redirect("/admin/credits?saved=values");
}
