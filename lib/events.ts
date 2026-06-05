import { createClient } from "@/lib/supabase/server";

// Fire-and-forget funnel event logging. Never throws — analytics must
// never break a user-facing flow.
// Funnel: listing_created → accreditation_applied → application_approved →
//         profile_published → enquiry_submitted → enquiry_converted
export async function logEvent(
  event: string,
  data: { school_id?: string | null; profile_id?: string | null; meta?: Record<string, unknown> } = {}
) {
  try {
    const supabase = await createClient();
    await supabase.from("events").insert({
      event,
      school_id: data.school_id ?? null,
      profile_id: data.profile_id ?? null,
      meta: data.meta ?? {},
    });
  } catch (err) {
    console.error("[event logging failed]", err);
  }
}
