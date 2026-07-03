import type { SupabaseClient } from "@supabase/supabase-js";

// GSA credits: an append-only ledger (credit_ledger). Balance = sum of deltas.
// Award values live in app_settings (credits_<reason>) so GSA can retune them
// without a deploy. Automated awards are idempotent: the ledger has a unique
// (school_id, reason, ref_id) constraint, so re-running a hook is a no-op.

export const CREDIT_REASON_LABELS: Record<string, string> = {
  profile_verified: "Profile verified",
  booking: "Trip booked",
  hosting: "Hosted a group",
  referral: "Referred a school",
  admin_adjustment: "GSA adjustment",
};

export type CreditReason = keyof typeof CREDIT_REASON_LABELS;

export type CreditRow = {
  id: string;
  school_id: string;
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
};

type Client = SupabaseClient<any, any, any>;

// Configured award size for a reason; 0 disables that award.
export async function creditValue(
  supabase: Client,
  reason: CreditReason
): Promise<number> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", `credits_${reason}`)
    .maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

// Award credits for an automated event. Caller must hold write access to the
// ledger (GSA admin session or service role). Never throws — a failed award
// must not break the money/approval flow it rides on.
export async function awardCredits(
  supabase: Client,
  schoolId: string,
  reason: Exclude<CreditReason, "admin_adjustment">,
  refId: string,
  note?: string
): Promise<void> {
  try {
    const delta = await creditValue(supabase, reason);
    if (!delta) return;
    const { error } = await supabase.from("credit_ledger").upsert(
      {
        school_id: schoolId,
        delta,
        reason,
        ref_id: refId,
        note: note ?? null,
      },
      { onConflict: "school_id,reason,ref_id", ignoreDuplicates: true }
    );
    if (error) console.error(`[credits] award ${reason} failed:`, error.message);
  } catch (e) {
    console.error(`[credits] award ${reason} failed:`, e);
  }
}

export async function creditHistory(
  supabase: Client,
  schoolId: string
): Promise<{ balance: number; rows: CreditRow[] }> {
  const { data } = await supabase
    .from("credit_ledger")
    .select("id, school_id, delta, reason, note, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as CreditRow[];
  return { balance: rows.reduce((s, r) => s + r.delta, 0), rows };
}
