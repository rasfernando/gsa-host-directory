"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe";

// Parents aren't signed in: everything is keyed by the unguessable token,
// resolved through the SECURITY DEFINER lookup. No other data is reachable.
export async function payParentLink(formData: FormData) {
  const token = String(formData.get("token"));
  const supabase = await createClient();

  const { data } = await supabase.rpc("parent_payment_by_token", {
    p_token: token,
  });
  const payment = Array.isArray(data) ? data[0] : data;
  if (!payment || payment.status !== "pending") redirect(`/pay/${token}`);

  const h = await headers();
  const origin =
    h.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;

  const url = await createCheckoutSession({
    amountPennies: payment.amount_pennies,
    name: `${payment.trip_label} — place for ${payment.parent_name}`,
    successUrl: `${origin}/pay/${token}?paid=processing`,
    cancelUrl: `${origin}/pay/${token}`,
    metadata: { kind: "parent", id: payment.id },
  });
  if (url) redirect(url);
  redirect(`/pay/${token}?card=unavailable`);
}
