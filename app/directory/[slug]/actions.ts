"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa, sendEmail, escapeHtml } from "@/lib/notify";
import { logEvent } from "@/lib/events";

// Submits an enquiry about a host school. Works for signed-out visitors —
// RLS only allows inserts against published profiles.
export async function submitEnquiry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = String(formData.get("slug"));

  // Rate-limit anonymous submissions: the form sends two emails per call (GSA
  // alert + confirmation to a caller-supplied address), so throttle by IP to
  // stop email-bombing / cost amplification. Fail open if we can't read an IP.
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";
  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_key: `enquiry:${ip}`,
    p_max: 5,
    p_window_seconds: 3600,
  });
  if (allowed === false) {
    redirect(`/directory/${slug}?enquiry=throttled`);
  }

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
  const e = {
    school: escapeHtml(formData.get("enquirer_school_name")),
    name: escapeHtml(formData.get("enquirer_name")),
    email: escapeHtml(formData.get("enquirer_email")),
    dates: escapeHtml(formData.get("preferred_dates") || "not specified"),
    group: escapeHtml(formData.get("group_size") || "not specified"),
    message: escapeHtml(formData.get("message")),
  };

  await notifyGsa(
    `New enquiry: ${e.school} → ${escapeHtml(slug)}`,
    `<p><strong>${e.school}</strong> has enquired about a visit.</p>
     <p>From: ${e.name} — ${e.email}</p>
     <p>Dates: ${e.dates} · Group: ${e.group}</p>
     <blockquote>${e.message}</blockquote>
     <p><a href="https://gsa-host-directory.vercel.app/admin/enquiries">Open enquiries</a></p>`
  );

  // Confirmation copy to the enquirer
  await sendEmail(
    String(formData.get("enquirer_email")),
    "Your enquiry to the Global School Alliance",
    `<p>Hi ${e.name},</p>
     <p>Thanks for your enquiry — a member of the GSA team will review it and
     contact you within 2–3 working days to discuss the visit and introduce
     you to the school.</p>
     <p><strong>Your enquiry:</strong></p>
     <blockquote>${e.message}</blockquote>
     <p>Preferred dates: ${e.dates} ·
     Group size: ${e.group}</p>
     <p>— The Global School Alliance team</p>`
  );

  redirect(`/directory/${slug}?enquiry=sent`);
}
