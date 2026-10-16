"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logEvent } from "@/lib/events";

// Before this existed, making someone a GSA admin meant running SQL against
// user_profiles by hand — a standing dependency on one person. Invite only:
// demotion stays a dashboard job for now, which also sidesteps the
// lock-yourself-out bug class entirely.

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

function fail(message: string): never {
  redirect(`/admin/team?error=${encodeURIComponent(message)}`);
}

export async function inviteAdmin(formData: FormData) {
  const { user: actor } = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address");

  // The service role is the only thing that can create auth users or read
  // other people's profiles. It bypasses RLS, so it stays behind requireAdmin
  // above and never touches anything derived from user input beyond `email`.
  const service = createServiceClient();
  if (!service) {
    fail("Invites need SUPABASE_SERVICE_ROLE_KEY, which is set in production but not in this environment");
  }

  // Same origin derivation as app/pay/actions.ts.
  const h = await headers();
  const origin =
    h.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;

  let userId: string;
  let invited = false;

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/admin`,
  });

  if (!error && data.user) {
    userId = data.user.id;
    invited = true;
  } else {
    // Most likely they already have an account (e.g. they registered a host
    // school first). Promote the existing user rather than erroring out —
    // this is exactly the case that used to need hand-written SQL.
    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) fail(listErr.message);
    const existing = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) fail(error?.message ?? "Could not invite that address");
    userId = existing.id;
  }

  // The profile row is normally created by a database trigger on signup.
  // Update first so an existing row keeps its other columns; insert only if
  // the trigger didn't run.
  const { data: updated, error: updErr } = await service
    .from("user_profiles")
    .update({ role: "gsa_admin" })
    .eq("id", userId)
    .select("id");
  if (updErr) fail(updErr.message);
  if (!updated || updated.length === 0) {
    const { error: insErr } = await service
      .from("user_profiles")
      .insert({ id: userId, role: "gsa_admin" });
    if (insErr) fail(insErr.message);
  }

  await logEvent(invited ? "admin_invited" : "admin_promoted", {
    meta: { email, by: actor.id },
  });
  revalidatePath("/admin/team");
  redirect(`/admin/team?saved=${invited ? "invited" : "promoted"}`);
}
