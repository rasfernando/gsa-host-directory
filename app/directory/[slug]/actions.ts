"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Submits an enquiry about a host school. Works for signed-out visitors —
// RLS only allows inserts against published profiles.
export async function submitEnquiry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = String(formData.get("slug"));

  const { error } = await supabase.from("enquiries").insert({
    host_profile_id: String(formData.get("host_profile_id")),
    enquirer_school_name: String(formData.get("enquirer_school_name")),
    enquirer_name: String(formData.get("enquirer_name")),
    enquirer_email: String(formData.get("enquirer_email")),
    message: String(formData.get("message")),
    preferred_dates: String(formData.get("preferred_dates") || ""),
    group_size: formData.get("group_size")
      ? Number(formData.get("group_size"))
      : null,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(`Could not send enquiry: ${error.message}`);

  redirect(`/directory/${slug}?enquiry=sent`);
}
