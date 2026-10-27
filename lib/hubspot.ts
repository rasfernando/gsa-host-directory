// HubSpot sync, env-gated like lib/notify.ts: without HUBSPOT_PRIVATE_APP_TOKEN
// nothing is sent and registration carries on. Never throws — the CRM must not
// be able to break a school's registration.
//
// Why: schools used to fill in a HubSpot web form AND a directory form. Now the
// directory registration is the one form, and this pushes the contact and the
// school (as a company) into HubSpot so the CRM stays the record.
//
// Rules agreed with Heather (27 Oct 2026):
//  - Never duplicate: contacts are matched on email; companies on website
//    domain (only when the matched company has the same name — academy trusts
//    share one domain across many schools) and otherwise on name.
//  - Never overwrite: on an existing record only EMPTY properties are filled.
//    Two exceptions, which are always set: Company "Type" = SCHOOL and the
//    "GSA Host Directory Submission" tag on both records.
//  - Field mapping follows "Host Network Field Mapping - sign up form.csv".
//
// Setup (GSA side): HubSpot → Settings → Integrations → Private Apps (now
// "Service Keys"): scopes crm.objects.contacts.read/write and
// crm.objects.companies.read/write. Token → Vercel HUBSPOT_PRIVATE_APP_TOKEN.
//
// Tag property (Heather creates it, we can't with object-only scopes):
// a single checkbox on BOTH Contacts and Companies, label
// "GSA Host Directory Submission", internal name gsa_host_directory_submission.
// Until it exists HubSpot rejects it; we then retry without it, so the sync
// still works, just untagged.

const BASE = "https://api.hubapi.com";
const TAG_PROPERTY = "gsa_host_directory_submission";

export type SchoolContact = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  phone?: string | null;
  schoolName: string;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  postcode?: string | null;
  schoolType?: string | null;
  whyHost?: string | null;
  ageBand?: string | null;
  agesFrom?: number | null;
  agesTo?: number | null;
  capacity?: number | null;
  subjects?: string[];
  boarding?: boolean;
  homestay?: boolean;
  hostedBefore?: boolean | null;
  hostMultiple?: boolean | null;
  hostMonths?: string[];
};

// Option lists in HubSpot. Anything else is dropped rather than rejected.
const HS_SUBJECTS = new Set([
  "Art", "Music", "Languages", "STEM", "Science", "Maths", "Engineering",
  "Computer Science", "Robotics", "Geography", "History", "Environmental Science",
]);
const HS_MONTHS = new Set([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);
// Form band → HubSpot "Age range" option. "Other" has no equivalent.
const HS_AGE_RANGE: Record<string, string> = {
  Primary: "Primary",
  Secondary: "Secondary",
  "All-through": "All-through",
  "Higher Education": "Higher",
};

type Props = Record<string, string>;

export async function syncSchoolToHubspot(c: SchoolContact): Promise<void> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    console.log(`[hubspot skipped — HUBSPOT_PRIVATE_APP_TOKEN not set] ${c.schoolName}`);
    return;
  }
  if (!c.email) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // ── Contact ──────────────────────────────────────────────────────────
    const email = c.email.toLowerCase();
    const contactProps = clean({
      email,
      firstname: c.firstName,
      lastname: c.lastName,
      jobtitle: c.role,
      phone: c.phone,
    });
    const contactId = await upsert("contacts", [{ property: "email", value: email }], contactProps, headers);

    // ── Company ──────────────────────────────────────────────────────────
    let domain: string | null = null;
    if (c.website) {
      try {
        domain = new URL(c.website).hostname.replace(/^www\./, "");
      } catch {
        domain = null;
      }
    }
    const companyProps = clean({
      name: c.schoolName,
      domain,
      type_of_school: c.schoolType,
      country: c.country,
      city: c.city,
      zip: c.postcode,
      hosting_network__reason_for_hosting: c.whyHost,
      age_range: c.ageBand ? HS_AGE_RANGE[c.ageBand] : null,
      hosting_network__ages_from: c.agesFrom,
      hosting_network__ages_to: c.agesTo,
      hosting_network__maximum_student_group_size: c.capacity,
      hosting_network__subject_strengths: (c.subjects ?? []).filter((s) => HS_SUBJECTS.has(s)).join(";") || null,
      hosting_network__boarding_available: c.boarding,
      hosting_network__homestay_available: c.homestay,
      hosting_network__previous_international_hosting: c.hostedBefore,
      hosting_network__repeat_hosting_availability: c.hostMultiple,
      hosting_network__available_months: (c.hostMonths ?? []).filter((m) => HS_MONTHS.has(m)).join(";") || null,
    });
    const matchers = [
      ...(domain ? [{ property: "domain", value: domain, requireName: c.schoolName }] : []),
      { property: "name", value: c.schoolName },
    ];
    const companyId = await upsert("companies", matchers, companyProps, headers, { type: "SCHOOL" });

    // ── Link them ────────────────────────────────────────────────────────
    if (contactId && companyId) {
      // v4 "default association" — contact ↔ company, no label needed.
      const res = await fetch(
        `${BASE}/crm/v4/objects/contacts/${contactId}/associations/default/companies/${companyId}`,
        { method: "PUT", headers }
      );
      if (!res.ok) console.error(`[hubspot associate failed] ${res.status}`);
    }
  } catch (err) {
    console.error("[hubspot sync failed]", err);
  }
}

// Drop null/undefined/"" and stringify the rest the way HubSpot wants it.
function clean(o: Record<string, string | number | boolean | null | undefined>): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null || v === "") continue;
    out[k] = typeof v === "boolean" ? String(v) : String(v);
  }
  return out;
}

type Matcher = { property: string; value: string; requireName?: string };

// Find by the first matcher that hits; fill only EMPTY properties if found,
// create if not. `always` is written regardless. Returns the record id.
async function upsert(
  object: "contacts" | "companies",
  matchers: Matcher[],
  properties: Props,
  headers: Record<string, string>,
  always: Props = {}
): Promise<string | null> {
  const wanted = [...new Set([...Object.keys(properties), ...Object.keys(always), "name"])];

  for (const m of matchers) {
    const search = await fetch(`${BASE}/crm/v3/objects/${object}/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: m.property, operator: "EQ", value: m.value }] }],
        properties: wanted,
        limit: 5,
      }),
    });
    if (!search.ok) continue;
    const data = (await search.json()) as { results?: { id: string; properties: Record<string, string | null> }[] };
    let hit = data.results?.[0];
    if (m.requireName) {
      hit = data.results?.find((r) => (r.properties.name ?? "").trim().toLowerCase() === m.requireName!.trim().toLowerCase());
    }
    if (!hit) continue;

    // Existing record: never overwrite what's already there.
    const fill: Props = { ...always, [TAG_PROPERTY]: "true" };
    for (const [k, v] of Object.entries(properties)) {
      const current = hit.properties[k];
      if (current == null || String(current).trim() === "") fill[k] = v;
    }
    await patch(`${BASE}/crm/v3/objects/${object}/${hit.id}`, fill, headers, `${object} update`);
    return hit.id;
  }

  const created = await patch(
    `${BASE}/crm/v3/objects/${object}`,
    { ...properties, ...always, [TAG_PROPERTY]: "true" },
    headers,
    `${object} create`,
    "POST"
  );
  return created?.id ?? null;
}

// Write properties; if HubSpot rejects some (property doesn't exist yet, or a
// value isn't one of its options), drop just those and try once more.
async function patch(
  url: string,
  properties: Props,
  headers: Record<string, string>,
  label: string,
  method: "PATCH" | "POST" = "PATCH"
): Promise<{ id?: string } | null> {
  let res = await fetch(url, { method, headers, body: JSON.stringify({ properties }) });
  if (res.status === 400) {
    const body = await res.text();
    const bad = [...body.matchAll(/\\?"name\\?":\\?"([^"\\]+)/g)].map((x) => x[1]);
    const remaining = Object.fromEntries(Object.entries(properties).filter(([k]) => !bad.includes(k)));
    if (bad.length > 0 && Object.keys(remaining).length > 0) {
      console.warn(`[hubspot ${label}: dropped ${bad.join(", ")}]`);
      res = await fetch(url, { method, headers, body: JSON.stringify({ properties: remaining }) });
    } else {
      console.error(`[hubspot ${label} failed] 400 ${body.slice(0, 300)}`);
      return null;
    }
  }
  if (!res.ok) {
    console.error(`[hubspot ${label} failed] ${res.status}`);
    return null;
  }
  return (await res.json()) as { id?: string };
}
