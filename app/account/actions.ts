"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Change the signed-in user's password. Works for any role (admin, agent,
// school) — no email round-trip, uses the current session.
export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const password = String(formData.get("password") || "");
  if (password.length < 8) redirect("/account?pw=short");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/account?pw=error");
  redirect("/account?pw=changed");
}
