// HubSpot sync, env-gated like lib/notify.ts: without HUBSPOT_PRIVATE_APP_TOKEN
// nothing is sent and registration carries on. Never throws — the CRM must not
// be able to break a school's registration.
//
// Why: schools used to fill in a HubSpot web form AND a directory form. Now the
// directory registration is the one form, and this pushes the contact and the
// school (as a company) into HubSpot so the CRM stays the record.
//
// Setup (GSA side): HubSpot → Settings → Integrations → Private apps → create
// one with crm.objects.contacts.write and crm.objects.companies.write, and put
// its token in Vercel as HUBSPOT_PRIVATE_APP_TOKEN.

const BASE = "https://api.hubapi.com";

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
};

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
    const contactId = await upsert(
      "contacts",
      "email",
      c.email.toLowerCase(),
      {
        email: c.email.toLowerCase(),
        firstname: c.firstName ?? "",
        lastname: c.lastName ?? "",
        jobtitle: c.role ?? "",
        ...(c.phone ? { phone: c.phone } : {}),
      },
      headers
    );

    let domain: string | null = null;
    if (c.website) {
      try {
        domain = new URL(c.website).hostname.replace(/^www\./, "");
      } catch {
        domain = null;
      }
    }
    const companyId = await upsert(
      "companies",
      domain ? "domain" : "name",
      domain ?? c.schoolName,
      {
        name: c.schoolName,
        ...(domain ? { domain } : {}),
        country: c.country ?? "",
        city: c.city ?? "",
        ...(c.postcode ? { zip: c.postcode } : {}),
      },
      headers
    );

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

// Find by one property; update if found, create if not. Returns the record id.
async function upsert(
  object: "contacts" | "companies",
  property: string,
  value: string,
  properties: Record<string, string>,
  headers: Record<string, string>
): Promise<string | null> {
  const search = await fetch(`${BASE}/crm/v3/objects/${object}/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: property, operator: "EQ", value }] }],
      limit: 1,
    }),
  });
  if (search.ok) {
    const data = (await search.json()) as { results?: { id: string }[] };
    const id = data.results?.[0]?.id;
    if (id) {
      const upd = await fetch(`${BASE}/crm/v3/objects/${object}/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ properties }),
      });
      if (!upd.ok) console.error(`[hubspot ${object} update failed] ${upd.status}`);
      return id;
    }
  }

  const created = await fetch(`${BASE}/crm/v3/objects/${object}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ properties }),
  });
  if (!created.ok) {
    console.error(`[hubspot ${object} create failed] ${created.status}`);
    return null;
  }
  const data = (await created.json()) as { id?: string };
  return data.id ?? null;
}
