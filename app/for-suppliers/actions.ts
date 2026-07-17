"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa, escapeHtml } from "@/lib/notify";
import { normalizeUrl } from "@/lib/forms";

type Doc = { name: string; path: string; category?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/for-suppliers");
  return { supabase, user };
}

async function ownProfile() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("supplier_profiles")
    .select("id, evidence_files, status")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  return { supabase, user, profile };
}

// Create the profile on first save, then update thereafter.
export async function updateSupplierProfile(formData: FormData) {
  const { supabase, user, profile } = await ownProfile();
  const fields = {
    company_name: String(formData.get("company_name") || "").trim(),
    contact_name: String(formData.get("contact_name") || "") || null,
    contact_email: String(formData.get("contact_email") || "") || null,
    country: String(formData.get("country") || "") || null,
    website: normalizeUrl(formData.get("website") as string),
    description: String(formData.get("description") || "") || null,
  };
  if (!fields.company_name) redirect("/for-suppliers?error=name");

  if (profile) {
    const { error } = await supabase
      .from("supplier_profiles")
      .update(fields)
      .eq("id", profile.id);
    if (error) redirect(`/for-suppliers?error=${encodeURIComponent(error.message)}`);
  } else {
    const { error } = await supabase.from("supplier_profiles").insert({
      ...fields,
      owner_user_id: user.id,
      created_by: user.id,
    });
    if (error) redirect(`/for-suppliers?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/for-suppliers");
  redirect("/for-suppliers?saved=1");
}

export async function uploadSupplierLogo(formData: FormData) {
  const { supabase, profile } = await ownProfile();
  if (!profile) redirect("/for-suppliers?error=noprofile");
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) redirect("/for-suppliers?error=nofile");
  if (file.size > 2 * 1024 * 1024) redirect("/for-suppliers?error=toobig");
  if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type))
    redirect("/for-suppliers?error=logotype");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${profile.id}/logo-${Date.now()}.${ext}`;
  const { error: up } = await supabase.storage
    .from("supplier-docs")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (up) redirect(`/for-suppliers?error=${encodeURIComponent(up.message)}`);
  // Logo lives in the private bucket; store the path (viewed via signed URL).
  await supabase.from("supplier_profiles").update({ logo_url: path }).eq("id", profile.id);
  revalidatePath("/for-suppliers");
  redirect("/for-suppliers?saved=logo");
}

export async function addSupplierDoc(formData: FormData) {
  const { supabase, profile } = await ownProfile();
  if (!profile) redirect("/for-suppliers?error=noprofile");
  const file = formData.get("document") as File | null;
  const category = String(formData.get("category") || "other");
  if (!file || file.size === 0) redirect("/for-suppliers?error=nofile");
  if (file.size > 10 * 1024 * 1024) redirect("/for-suppliers?error=toobig");

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${profile.id}/${category}-${Date.now()}-${safe}`;
  const { error: up } = await supabase.storage
    .from("supplier-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (up) redirect(`/for-suppliers?error=${encodeURIComponent(up.message)}`);

  const docs = ((profile.evidence_files as Doc[] | null) ?? []).slice();
  docs.push({ name: file.name, path, category });
  await supabase.from("supplier_profiles").update({ evidence_files: docs }).eq("id", profile.id);
  revalidatePath("/for-suppliers");
  redirect("/for-suppliers?saved=doc");
}

export async function removeSupplierDoc(formData: FormData) {
  const { supabase, profile } = await ownProfile();
  if (!profile) redirect("/for-suppliers");
  const path = String(formData.get("path") || "");
  const docs = ((profile.evidence_files as Doc[] | null) ?? []).filter((d) => d.path !== path);
  await supabase.storage.from("supplier-docs").remove([path]);
  await supabase.from("supplier_profiles").update({ evidence_files: docs }).eq("id", profile.id);
  revalidatePath("/for-suppliers");
  redirect("/for-suppliers?saved=doc");
}

export async function submitSupplierProfile() {
  const { supabase, profile } = await ownProfile();
  if (!profile) redirect("/for-suppliers?error=noprofile");
  // The trigger allows the owner the draft -> submitted transition only.
  const { error } = await supabase
    .from("supplier_profiles")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (error) redirect(`/for-suppliers?error=${encodeURIComponent(error.message)}`);
  await notifyGsa(
    "Supplier profile submitted for verification",
    `<p>A supplier has submitted their profile for verification.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/suppliers/${escapeHtml(profile.id)}">Review the supplier</a></p>`
  );
  redirect("/for-suppliers?submitted=1");
}
