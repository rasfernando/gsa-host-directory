import { createServiceClient } from "@/lib/supabase/service";

// Accounts that started registering but have no profile yet, so Heather can
// follow up and help them finish (9 Nov 2026).
//
// Two kinds:
//  - signed up, never submitted a form (no school linked to the account)
//  - has a school but no profile (the old accreditation-form route)
//
// Emails live in auth.users, which only the service role can read — same as
// the Team tab. Returns null when that key isn't configured.

export type StartedAccount = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmed: boolean;
  schoolName: string | null;
  applicationId: string | null;
};

export async function loadStartedAccounts(): Promise<StartedAccount[] | null> {
  const service = createServiceClient();
  if (!service) return null;

  const [users, profiles, hostProfiles, schools, applications] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from("user_profiles").select("id, role, school_id"),
    service.from("host_profiles").select("school_id"),
    service.from("schools").select("id, name"),
    service.from("host_applications").select("id, school_id"),
  ]);
  if (users.error) {
    console.error("[started accounts] could not list users:", users.error.message);
    return null;
  }

  const byUser = new Map(
    (profiles.data ?? []).map((p) => [p.id as string, p as { role: string | null; school_id: string | null }])
  );
  const listed = new Set((hostProfiles.data ?? []).map((p) => p.school_id as string));
  const schoolName = new Map((schools.data ?? []).map((s) => [s.id as string, s.name as string]));
  const applicationFor = new Map(
    (applications.data ?? []).map((a) => [a.school_id as string, a.id as string])
  );

  const started: StartedAccount[] = [];
  for (const u of users.data.users) {
    if (!u.email) continue;
    const p = byUser.get(u.id);
    if (p?.role === "gsa_admin" || p?.role === "agent") continue; // staff, not schools
    const schoolId = p?.school_id ?? null;
    if (schoolId && listed.has(schoolId)) continue; // finished: has a profile
    started.push({
      id: u.id,
      email: u.email,
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      confirmed: Boolean(u.email_confirmed_at),
      schoolName: schoolId ? (schoolName.get(schoolId) ?? null) : null,
      applicationId: schoolId ? (applicationFor.get(schoolId) ?? null) : null,
    });
  }
  return started.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
