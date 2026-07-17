"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { normalizeUrl } from "@/lib/forms";

type Doc = { name: string; path: string; category?: string };

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

// Edit a supplier's profile fields (GSA fills these in for manually-added
// suppliers, or corrects self-registered ones).
export async function adminUpdateSupplier(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("supplier_id"));
  const company_name = String(formData.get("company_name") || "").trim();
  if (!company_name) redirect(`/admin/suppliers/${id}?error=name`);
  const { error } = await supabase
    .from("supplier_profiles")
    .update({
      company_name,
      contact_name: String(formData.get("contact_name") || "") || null,
      contact_email: String(formData.get("contact_email") || "") || null,
      country: String(formData.get("country") || "") || null,
      website: normalizeUrl(formData.get("website") as string),
      description: String(formData.get("description") || "") || null,
    })
    .eq("id", id);
  if (error) redirect(`/admin/suppliers/${id}?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/suppliers/${id}?saved=details`);
}

// GSA uploads a document on the supplier's behalf (e.g. emailed to us).
export async function adminAddSupplierDoc(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("supplier_id"));
  const category = String(formData.get("category") || "other");
  const file = formData.get("document") as File | null;
  if (!file || file.size === 0) redirect(`/admin/suppliers/${id}?error=nofile`);
  if (file.size > 10 * 1024 * 1024) redirect(`/admin/suppliers/${id}?error=toobig`);

  const { data: sp } = await supabase
    .from("supplier_profiles")
    .select("evidence_files")
    .eq("id", id)
    .single();
  if (!sp) redirect("/admin/suppliers");

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${id}/${category}-${Date.now()}-${safe}`;
  const { error: up } = await supabase.storage
    .from("supplier-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (up) redirect(`/admin/suppliers/${id}?error=${encodeURIComponent(up.message)}`);

  const docs = ((sp.evidence_files as Doc[] | null) ?? []).slice();
  docs.push({ name: file.name, path, category });
  await supabase.from("supplier_profiles").update({ evidence_files: docs }).eq("id", id);
  redirect(`/admin/suppliers/${id}?saved=doc`);
}

export async function adminRemoveSupplierDoc(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("supplier_id"));
  const path = String(formData.get("path") || "");
  const { data: sp } = await supabase
    .from("supplier_profiles")
    .select("evidence_files")
    .eq("id", id)
    .single();
  if (!sp) redirect("/admin/suppliers");
  const docs = ((sp.evidence_files as Doc[] | null) ?? []).filter((d) => d.path !== path);
  await supabase.storage.from("supplier-docs").remove([path]);
  await supabase.from("supplier_profiles").update({ evidence_files: docs }).eq("id", id);
  redirect(`/admin/suppliers/${id}?saved=doc`);
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
