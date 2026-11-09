import type { createClient } from "@/lib/supabase/server";
import type { SchoolContact } from "@/lib/hubspot";

// "Everything shows in Profiles" (Heather, 9 Nov 2026).
//
// The registration form (/list-your-school) has always created an unpublished
// "listed" host profile, which is what the admin Profiles tab lists. The
// accreditation form (/apply) and the invite intake (/onboard) only filed an
// application, so those schools sat in the review queue and nowhere else.
// This gives any school the same listed profile, built from the answers it has
// already given, without ever touching a profile that exists.

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Answers = Record<string, unknown>;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const count = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
const items = (v: unknown) =>
  Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [];
const yesNo = (v: unknown) => (typeof v === "boolean" ? v : null);

export function slugFor(name: string, suffix: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "school"}-${suffix}`;
}

export const randomSuffix = () => Math.random().toString(36).slice(2, 6);

// Creates the listed profile if the school has none. Never throws and never
// overwrites: `created` is false when a profile was already there.
export async function ensureListedProfile(
  supabase: Supabase,
  input: {
    schoolId: string;
    schoolName: string;
    country?: string | null;
    city?: string | null;
    answers?: Answers;
    slugSuffix?: string;
  }
): Promise<{ id: string | null; created: boolean; error: string | null }> {
  const a = input.answers ?? {};

  const { data: existing, error: lookupError } = await supabase
    .from("host_profiles")
    .select("id")
    .eq("school_id", input.schoolId)
    .limit(1);
  if (lookupError) return { id: null, created: false, error: lookupError.message };
  if (existing && existing.length > 0) {
    return { id: existing[0].id as string, created: false, error: null };
  }

  const { data: created, error } = await supabase
    .from("host_profiles")
    .insert({
      school_id: input.schoolId,
      name: input.schoolName,
      slug: slugFor(input.schoolName, input.slugSuffix ?? randomSuffix()),
      tier: "listed",
      published: false,
      country: input.country ?? "",
      state: text(a.state),
      city: input.city ?? "",
      why_host: text(a.why_host),
      languages: items(a.languages),
      age_band: text(a.age_band),
      age_range_min: count(a.age_range_min),
      age_range_max: count(a.age_range_max),
      subject_strengths: items(a.subject_strengths),
      focus_tags: items(a.focus_areas),
      boarding: Boolean(a.boarding),
      homestay: Boolean(a.homestay),
      hosted_before: yesNo(a.hosted_before),
      host_months: items(a.host_months),
      capacity: count(a.capacity),
    })
    .select("id")
    .single();
  // 23505: another request created it in between — that is still "exists".
  if (error) {
    return { id: null, created: false, error: error.code === "23505" ? null : error.message };
  }
  return { id: (created?.id as string) ?? null, created: true, error: null };
}

// The hosting half of the HubSpot payload, from the same answers.
export function hubspotHostingFields(
  answers: Answers
): Pick<
  SchoolContact,
  | "role" | "whyHost" | "ageBand" | "agesFrom" | "agesTo" | "capacity"
  | "subjects" | "boarding" | "homestay" | "hostedBefore" | "hostMonths"
> {
  return {
    role: text(answers.role_at_school),
    whyHost: text(answers.why_host),
    ageBand: text(answers.age_band),
    agesFrom: count(answers.age_range_min),
    agesTo: count(answers.age_range_max),
    capacity: count(answers.capacity),
    subjects: items(answers.subject_strengths),
    boarding: Boolean(answers.boarding),
    homestay: Boolean(answers.homestay),
    hostedBefore: yesNo(answers.hosted_before),
    hostMonths: items(answers.host_months),
  };
}

// "Jane Smith" → first / last, for the HubSpot contact.
export function splitName(full: string | null | undefined) {
  const [firstName, ...rest] = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: firstName ?? null, lastName: rest.join(" ") || null };
}
