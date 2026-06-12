import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for trusted backend work (the Stripe webhook recording
// payments). Env-gated: returns null when the key isn't configured, and
// callers must degrade gracefully. Never expose this client to user input.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
