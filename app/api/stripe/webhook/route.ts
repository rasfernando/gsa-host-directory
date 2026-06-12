import { verifyStripeSignature } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

// Stripe test-mode webhook: records completed Checkout Sessions against the
// matching payment object via the SECURITY DEFINER mark-paid RPCs. Fully
// env-gated — without STRIPE_WEBHOOK_SECRET + service key this endpoint
// declines and the admin "mark as paid" flow covers the demo.
export async function POST(req: Request) {
  const payload = await req.text();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("stripe webhook not configured", { status: 503 });
  }
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"))) {
    return new Response("invalid signature", { status: 400 });
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return new Response("service client not configured", { status: 503 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: {
      object: {
        id: string;
        payment_intent?: string;
        metadata?: Record<string, string>;
      };
    };
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const md = session.metadata ?? {};
    const ref = session.payment_intent ?? session.id;

    let error: { message: string } | null = null;
    if (md.kind === "deposit" && md.trip_id) {
      ({ error } = await supabase.rpc("mark_deposit_paid", {
        p_trip: md.trip_id,
        p_ref: ref,
      }));
    } else if (md.kind === "installment" && md.id) {
      ({ error } = await supabase.rpc("mark_installment_paid", {
        p_installment: md.id,
        p_ref: ref,
      }));
    } else if (md.kind === "parent" && md.id) {
      ({ error } = await supabase.rpc("mark_parent_payment_paid", {
        p_payment: md.id,
        p_ref: ref,
      }));
    } else if (md.kind === "settlement" && md.id) {
      // Passthrough: customer paid GSA; the same-day transfer to the supplier
      // is recorded by the GSA team (live Connect transfers blocked pending
      // travel-law sign-off).
      ({ error } = await supabase.rpc("mark_settlement", {
        p_settlement: md.id,
        p_status: "customer_paid",
        p_ref: ref,
      }));
    }
    if (error) {
      console.error("[stripe webhook] failed to record payment:", error.message);
      return new Response("failed to record payment", { status: 500 });
    }
  }

  return Response.json({ received: true });
}
