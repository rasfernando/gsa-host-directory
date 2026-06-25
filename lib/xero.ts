// Xero (Accounting API) integration for non-card school invoices.
//
// Env-gated exactly like lib/notify.ts and lib/stripe.ts: with no Xero
// credentials every function no-ops and the caller falls back to the internal
// invoice page + our own email reminders. Nothing breaks without Xero.
//
// ⚠️ PRODUCTION-SENSITIVE: pushing invoices is live financial activity. Point
// XERO_TENANT_ID at the Xero **Demo Company** first; only switch to a real org
// after sign-off. Needs a Xero OAuth2 app (client id/secret) and a stored
// refresh token obtained once through the consent flow.
//
// Required env: XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REFRESH_TOKEN,
// XERO_TENANT_ID. Optional: XERO_ACCOUNT_CODE (sales account, default "200").

export function xeroEnabled(): boolean {
  return Boolean(
    process.env.XERO_CLIENT_ID &&
      process.env.XERO_CLIENT_SECRET &&
      process.env.XERO_REFRESH_TOKEN &&
      process.env.XERO_TENANT_ID
  );
}

type XeroToken = { access_token: string; refresh_token: string };

// Exchange the stored refresh token for a fresh access token. Xero rotates
// refresh tokens on every use; in a real deployment the new one must be
// persisted (e.g. to app_settings). Here we surface it to the caller.
async function refreshAccessToken(): Promise<XeroToken | null> {
  try {
    const res = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: process.env.XERO_REFRESH_TOKEN!,
      }),
    });
    if (!res.ok) {
      console.error(`[xero token] ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as XeroToken;
    return data;
  } catch (err) {
    console.error("[xero token] failed", err);
    return null;
  }
}

type LineItem = { description: string; amountPennies: number };

// Create an authorised invoice in Xero and email it. Returns the linkage to
// store on our invoices row, or null on any failure (caller keeps fallback).
export async function createXeroInvoice(opts: {
  contactName: string;
  contactEmail?: string | null;
  reference: string; // our invoice_number
  dueDate: string | null; // ISO date
  lines: LineItem[];
}): Promise<{ id: string; url: string; status: string } | null> {
  if (!xeroEnabled()) {
    console.log(`[xero skipped — not configured] ${opts.reference}`);
    return null;
  }
  const token = await refreshAccessToken();
  if (!token) return null;

  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    "Xero-tenant-id": process.env.XERO_TENANT_ID!,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const accountCode = process.env.XERO_ACCOUNT_CODE || "200";

  try {
    const body = {
      Type: "ACCREC",
      Status: "AUTHORISED",
      Reference: opts.reference,
      ...(opts.dueDate ? { DueDate: opts.dueDate } : {}),
      Contact: {
        Name: opts.contactName,
        ...(opts.contactEmail ? { EmailAddress: opts.contactEmail } : {}),
      },
      LineItems: opts.lines.map((l) => ({
        Description: l.description,
        Quantity: 1,
        // Xero amounts are major units (GBP), not pennies.
        UnitAmount: (l.amountPennies / 100).toFixed(2),
        AccountCode: accountCode,
        TaxType: "NONE",
      })),
    };
    const res = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[xero invoice] ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as {
      Invoices?: { InvoiceID: string; Status: string }[];
    };
    const inv = data.Invoices?.[0];
    if (!inv) return null;

    // Best-effort: email the invoice from Xero.
    await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${inv.InvoiceID}/Email`, {
      method: "POST",
      headers,
      body: "{}",
    }).catch((e) => console.error("[xero email]", e));

    return {
      id: inv.InvoiceID,
      url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${inv.InvoiceID}`,
      status: inv.Status,
    };
  } catch (err) {
    console.error("[xero invoice] failed", err);
    return null;
  }
}

// Poll a single invoice's status (cron uses this to sync paid/unpaid).
// Returns the Xero status string (e.g. "PAID", "AUTHORISED") or null.
export async function getXeroInvoiceStatus(xeroInvoiceId: string): Promise<string | null> {
  if (!xeroEnabled()) return null;
  const token = await refreshAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices/${xeroInvoiceId}`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Xero-tenant-id": process.env.XERO_TENANT_ID!,
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Invoices?: { Status: string }[] };
    return data.Invoices?.[0]?.Status ?? null;
  } catch (err) {
    console.error("[xero status] failed", err);
    return null;
  }
}
