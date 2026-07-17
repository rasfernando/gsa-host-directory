"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function claimSupplierInvite(formData: FormData) {
  const token = String(formData.get("token"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/suppliers/onboard/${token}`)}`);

  const { error } = await supabase.rpc("claim_supplier_invite", { p_token: token });
  if (error) redirect(`/suppliers/onboard/${token}?error=${encodeURIComponent(error.message)}`);
  redirect("/for-suppliers?claimed=1");
}
