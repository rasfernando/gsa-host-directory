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

// GSA adds a supplier to the bank (unclaimed until they accept an invite).
export async function adminAddSupplier(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const company_name = String(formData.get("company_name") || "").trim();
  const contact_email = String(formData.get("contact_email") || "").trim() || null;
  const country = String(formData.get("country") || "").trim() || null;
  if (!company_name) redirect("/admin/suppliers?error=name");

  const { data, error } = await supabase
    .from("supplier_profiles")
    .insert({ company_name, contact_email, country, created_by: user.id })
    .select("id")
    .single();
  if (error) redirect(`/admin/suppliers?error=${encodeURIComponent(error.message)}`);
  await logEvent("supplier_added", { meta: { supplier_id: data.id } });
  redirect(`/admin/suppliers/${data.id}`);
}

// Record a verification check result.
export async function recordSupplierCheck(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("supplier_id"));
  const check_key = String(formData.get("check_key"));
  const status = String(formData.get("status"));
  const { error } = await supabase.from("supplier_verification_checks").upsert(
    {
      supplier_profile_id: id,
      check_key,
      status,
      notes: String(formData.get("notes") || ""),
      checked_by: user.id,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "supplier_profile_id,check_key" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/suppliers/${id}`);
}

// Verify or reject (or reopen) a supplier.
export async function setSupplierStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("supplier_id"));
  const status = String(formData.get("status"));
  if (!["draft", "submitted", "verified", "rejected"].includes(status))
    redirect(`/admin/suppliers/${id}`);
  const { error } = await supabase
    .from("supplier_profiles")
    .update({
      status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) redirect(`/admin/suppliers/${id}?error=${encodeURIComponent(error.message)}`);
  await logEvent("supplier_status_set", { meta: { supplier_id: id, status } });
  redirect(`/admin/suppliers/${id}?saved=status`);
}

// Create an invite link for a supplier to claim + complete their profile.
export async function createSupplierInvite(formData: FormData) {
  const { supabase } = await requireAdmin();
  const supplier_profile_id = String(formData.get("supplier_id"));
  const email = String(formData.get("email") || "").trim();
  const company_name = String(formData.get("company_name") || "") || null;
  if (!email) redirect(`/admin/suppliers/${supplier_profile_id}?error=email`);

  const { error } = await supabase
    .from("supplier_invites")
    .insert({ supplier_profile_id, email, company_name });
  if (error) redirect(`/admin/suppliers/${supplier_profile_id}?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/suppliers/${supplier_profile_id}?saved=invite`);
}
