import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe TEST MODE only. Like lib/notify.ts this degrades gracefully: if
// STRIPE_SECRET_KEY isn't set (or isn't a test key) every call no-ops and
// the app falls back to the admin "mark as paid" flow. A live key is
// refused outright — this codebase must never move real money.

function testKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith("sk_test_")) {
    console.error("[stripe disabled] STRIPE_SECRET_KEY is not a test-mode key");
    return null;
  }
  return key;
}

export function stripeEnabled(): boolean {
  return testKey() !== null;
}

// Creates a Checkout Session and returns its URL, or null when Stripe is
// unconfigured/unavailable (callers fall back to manual confirmation).
export async function createCheckoutSession(opts: {
  amountPennies: number;
  name: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<string | null> {
  const key = testKey();
  if (!key) {
    console.log(`[stripe skipped — STRIPE_SECRET_KEY not set] ${opts.name}`);
    return null;
  }

  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][product_data][name]": opts.name,
    "line_items[0][price_data][unit_amount]": String(opts.amountPennies),
    "line_items[0][quantity]": "1",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  for (const [k, v] of Object.entries(opts.metadata)) {
    body.set(`metadata[${k}]`, v);
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      console.error(`[stripe failed] ${res.status}: ${await res.text()}`);
      return null;
    }
    const session = (await res.json()) as { url?: string };
    return session.url ?? null;
  } catch (err) {
    console.error("[stripe failed]", err);
    return null;
  }
}

// Verifies a Stripe-Signature header (t=...,v1=...) against the raw payload.
export function verifyStripeSignature(
  payload: string,
  sigHeader: string | null
): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("=", 2) as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
