"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa, sendEmail } from "@/lib/notify";
import { logEvent } from "@/lib/events";

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

  await logEvent("enquiry_submitted", {
    profile_id: String(formData.get("host_profile_id")),
  });
  await notifyGsa(
    `New enquiry: ${formData.get("enquirer_school_name")} → ${slug}`,
    `<p><strong>${formData.get("enquirer_school_name")}</strong> has enquired about a visit.</p>
     <p>From: ${formData.get("enquirer_name")} — ${formData.get("enquirer_email")}</p>
     <p>Dates: ${formData.get("preferred_dates") || "not specified"} · Group: ${formData.get("group_size") || "not specified"}</p>
     <blockquote>${formData.get("message")}</blockquote>
     <p><a href="https://gsa-host-directory.vercel.app/admin/enquiries">Open enquiries</a></p>`
  );

  // Confirmation copy to the enquirer
  await sendEmail(
    String(formData.get("enquirer_email")),
    "Your enquiry to the Global School Alliance",
    `<p>Hi ${formData.get("enquirer_name")},</p>
     <p>Thanks for your enquiry — a member of the GSA team will review it and
     contact you within 2–3 working days to discuss the visit and introduce
     you to the school.</p>
     <p><strong>Your enquiry:</strong></p>
     <blockquote>${formData.get("message")}</blockquote>
     <p>Preferred dates: ${formData.get("preferred_dates") || "not specified"} ·
     Group size: ${formData.get("group_size") || "not specified"}</p>
     <p>— The Global School Alliance team</p>`
  );

  redirect(`/directory/${slug}?enquiry=sent`);
}
