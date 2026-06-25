"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa } from "@/lib/notify";
import { logEvent } from "@/lib/events";
import { createCheckoutSession } from "@/lib/stripe";
import { createXeroInvoice, xeroEnabled } from "@/lib/xero";
import { formatPounds } from "@/lib/money";

// Push the just-committed school invoice to Xero (no-op without Xero creds).
// Mirrors the itemised basket: GSA programme + ±10% + service fee − deposit.
async function pushSchoolInvoiceToXero(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  _hostProfileId: string | null
) {
  if (!xeroEnabled()) return;
  const [{ data: invoice }, { data: plan }, { data: trip }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("trip_id", tripId)
      .eq("recipient_type", "school")
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("payment_plans").select("*").eq("trip_id", tripId).maybeSingle(),
    supabase
      .from("trips")
      .select("organiser_school_name, organiser_id")
      .eq("id", tripId)
      .maybeSingle(),
  ]);
  if (!invoice || !plan || invoice.xero_invoice_id) return;

  const { data: organiser } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("id", trip?.organiser_id)
    .maybeSingle();

  const lines: { description: string; amountPennies: number }[] = [
    { description: "GSA immersion programme", amountPennies: plan.base_total_pennies },
  ];
  if (plan.adjustment_pennies)
    lines.push({
      description:
        plan.choice === "upfront" ? "Upfront discount (−10%)" : "Payment plan (+10%)",
      amountPennies: plan.adjustment_pennies,
    });
  if (plan.service_fee_pennies)
    lines.push({ description: "GSA service fee (non-refundable)", amountPennies: plan.service_fee_pennies });
  if (plan.deposit_credited_pennies)
    lines.push({ description: "Deposit credited", amountPennies: -plan.deposit_credited_pennies });

  const xero = await createXeroInvoice({
    contactName: trip?.organiser_school_name ?? "School",
    contactEmail: organiser?.email,
    reference: invoice.invoice_number,
    dueDate: invoice.due_date,
    lines,
  });
  if (xero) {
    await supabase
      .from("invoices")
      .update({ xero_invoice_id: xero.id, xero_url: xero.url, xero_status: xero.status })
      .eq("id", invoice.id);
  }
}

// Every mutation here runs as the signed-in organiser. RLS limits rows to
// their own trips, and DB triggers/RPCs own all prices and status moves —
// nothing money-sensitive is trusted from this layer.

async function requireUser(next = "/trips") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

async function ownTrip(tripId: string, next?: string) {
  const { supabase, user } = await requireUser(next ?? `/trips/${tripId}`);
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  if (!trip) redirect("/trips");
  return { supabase, user, trip };
}

// ── Step 1: confirm immersion core, objectives, destination ────────────────
export async function createTrip(formData: FormData) {
  const { supabase, user } = await requireUser("/trips/new");

  const hostProfileId = String(formData.get("host_profile_id") || "") || null;
  let country = String(formData.get("country") || "") || null;
  let productHost = hostProfileId;

  // Coming from a host profile page, lock destination to that school.
  if (hostProfileId) {
    const { data: hp } = await supabase
      .from("host_profiles")
      .select("id, country")
      .eq("id", hostProfileId)
      .eq("published", true)
      .single();
    if (hp) country = hp.country;
    else productHost = null;
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      organiser_id: user.id,
      organiser_school_name:
        String(formData.get("organiser_school_name") || "") || null,
      host_profile_id: productHost,
      country,
      impact_objectives: formData.getAll("objectives").map(String).filter(Boolean),
      product_type: "immersion_camp",
    })
    .select("id")
    .single();
  if (error || !trip) throw new Error(`Could not start trip: ${error?.message}`);

  await logEvent("trip_created", {
    profile_id: productHost,
    meta: { trip_id: trip.id },
  });
  redirect(`/trips/${trip.id}/plan`);
}

// ── Steps 2–4: host school, dates, group size ───────────────────────────────
export async function updateTripPlan(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase, trip } = await ownTrip(tripId, `/trips/${tripId}/plan`);
  if (trip.status !== "draft") redirect(`/trips/${tripId}`);

  const update: Record<string, unknown> = {};
  if (formData.has("host_profile_id")) {
    const id = String(formData.get("host_profile_id") || "") || null;
    update.host_profile_id = id;
    if (id) {
      const { data: hp } = await supabase
        .from("host_profiles")
        .select("country")
        .eq("id", id)
        .single();
      if (hp) update.country = hp.country;
    }
  }
  if (formData.has("start_date"))
    update.start_date = String(formData.get("start_date") || "") || null;
  const num = (k: string) =>
    formData.get(k) ? Number(formData.get(k)) : null;
  if (formData.has("num_days")) update.num_days = num("num_days");
  if (formData.has("num_students")) update.num_students = num("num_students");
  if (formData.has("staff_count")) update.staff_count = num("staff_count") ?? 2;
  if (formData.has("parent_count"))
    update.parent_count = num("parent_count") ?? num("num_students");

  const { error } = await supabase.from("trips").update(update).eq("id", tripId);
  if (error) throw new Error(`Could not save: ${error.message}`);

  const nextStep = String(formData.get("next_step") || "");
  redirect(nextStep ? `/trips/${tripId}/plan?step=${nextStep}` : `/trips/${tripId}/plan`);
}

// ── Step 5: reserve dates and places ────────────────────────────────────────
export async function reserveTrip(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase, trip } = await ownTrip(tripId);

  // Make sure the immersion line is in the basket — it is the core of the
  // trip. Price comes from the catalogue via the DB trigger.
  const { data: items } = await supabase
    .from("trip_items")
    .select("id, category")
    .eq("trip_id", tripId);
  const hasImmersion = (items ?? []).some((i) => i.category === "immersion_camp");
  if (!hasImmersion && trip.host_profile_id) {
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("type", "immersion_camp")
      .eq("host_profile_id", trip.host_profile_id)
      .eq("active", true)
      .limit(1)
      .single();
    // Hosts without a tailored product fall back to the generic GSA immersion.
    const productId =
      product?.id ??
      (
        await supabase
          .from("products")
          .select("id")
          .eq("type", "immersion_camp")
          .eq("active", true)
          .limit(1)
          .single()
      ).data?.id;
    if (productId) {
      await supabase.from("trip_items").insert({
        trip_id: tripId,
        product_id: productId,
        quantity: trip.num_students ?? 1,
      });
    }
  }

  const { error } = await supabase.rpc("reserve_trip", { p_trip: tripId });
  if (error) redirect(`/trips/${tripId}/plan?error=${encodeURIComponent(error.message)}`);

  await logEvent("trip_reserved", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId },
  });
  await notifyGsa(
    `Trip reserved — ${trip.organiser_school_name ?? "a school"}`,
    `<p><strong>${trip.organiser_school_name ?? "A school"}</strong> has reserved dates for a trip and now needs deposit confirmation.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/trips">Open trips</a></p>`
  );
  redirect(`/trips/${tripId}?reserved=1`);
}

// ── Basket: bolt-ons (prices enforced by the DB trigger) ────────────────────
export async function addItem(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const productId = String(formData.get("product_id"));
  const { supabase, trip } = await ownTrip(tripId);

  const { data: product } = await supabase
    .from("products")
    .select("id, type, pricing_unit")
    .eq("id", productId)
    .single();
  if (!product) redirect(`/trips/${tripId}`);

  // Sensible default quantities: immersion covers students; travel bolt-ons
  // cover the whole travelling party (students + staff).
  const travellers = (trip.num_students ?? 0) + (trip.staff_count ?? 0);
  const quantity =
    product.pricing_unit !== "per_place"
      ? 1
      : product.type === "immersion_camp"
        ? (trip.num_students ?? 1)
        : Math.max(travellers, 1);

  // One accommodation choice at a time: budget vs quality is a swap.
  if (product.type === "accommodation") {
    await supabase
      .from("trip_items")
      .delete()
      .eq("trip_id", tripId)
      .eq("category", "accommodation");
  }

  const { error } = await supabase.from("trip_items").insert({
    trip_id: tripId,
    product_id: productId,
    quantity,
  });
  if (error) redirect(`/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("trip_item_added", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId, product_id: productId },
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}#basket`);
}

export async function removeItem(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const itemId = String(formData.get("item_id"));
  const { supabase } = await ownTrip(tripId);
  await supabase.from("trip_items").delete().eq("id", itemId).eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}#basket`);
}

// ── Step 7: book a 1-2-1 call + parent-launch support ───────────────────────
export async function requestLaunchCall(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { user, trip } = await ownTrip(tripId);

  const preferred = String(formData.get("preferred_times") || "soon");
  await logEvent("launch_call_requested", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId },
  });
  await notifyGsa(
    `1-2-1 launch call requested — ${trip.organiser_school_name ?? "a school"}`,
    `<p><strong>${trip.organiser_school_name ?? "A school"}</strong> (${user.email}) has requested a 1-2-1 call and parent-launch support.</p>
     <p>Preferred times: ${preferred}</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/trips">Open trips</a></p>`
  );
  redirect(`/trips/${tripId}?call=requested`);
}

// ── Cancellation (refundable until the first payment is made) ───────────────
export async function cancelTrip(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase, trip } = await ownTrip(tripId);

  const { error } = await supabase.rpc("cancel_trip", { p_trip: tripId });
  if (error) redirect(`/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("trip_cancelled", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId },
  });
  await notifyGsa(
    `Trip cancelled — ${trip.organiser_school_name ?? "a school"}`,
    `<p>A trip has been cancelled by the organiser. Any refundable deposit has been marked for refund.</p>`
  );
  redirect(`/trips/${tripId}?cancelled=1`);
}

// ── Payments (Stripe TEST MODE, env-gated; admin mark-paid is the fallback) ─
async function siteOrigin() {
  const h = await headers();
  return (
    h.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`
  );
}

// Step 8: pay the £1,000 refundable deposit.
export async function payDeposit(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { trip } = await ownTrip(tripId);
  if (trip.status !== "reserved") redirect(`/trips/${tripId}`);

  const origin = await siteOrigin();
  const url = await createCheckoutSession({
    amountPennies: trip.deposit_amount_pennies,
    name: `Refundable trip deposit — ${trip.organiser_school_name ?? "school trip"}`,
    successUrl: `${origin}/trips/${tripId}?deposit=processing`,
    cancelUrl: `${origin}/trips/${tripId}`,
    metadata: { kind: "deposit", trip_id: tripId },
  });
  if (url) redirect(url);

  // Stripe unconfigured: hand over to the GSA team to confirm manually.
  await logEvent("deposit_payment_requested", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId },
  });
  await notifyGsa(
    `Deposit confirmation needed — ${trip.organiser_school_name ?? "a school"}`,
    `<p><strong>${trip.organiser_school_name ?? "A school"}</strong> wants to pay the ${formatPounds(trip.deposit_amount_pennies)} deposit, but card payments aren't configured. Arrange a transfer and mark the deposit paid in the admin area.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/trips">Open trips</a></p>`
  );
  redirect(`/trips/${tripId}?deposit=manual`);
}

// Step 9: commit to a payment plan; invoices / parent links are generated
// inside the DB function — totals and the ±10% rule never touch this layer.
export async function commitPlan(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase, trip } = await ownTrip(tripId);

  const mode = String(formData.get("mode"));
  const choice = String(formData.get("choice"));
  if (!["school_invoice", "parent_links"].includes(mode)) redirect(`/trips/${tripId}`);
  if (!["upfront", "installments"].includes(choice)) redirect(`/trips/${tripId}`);

  // Parent list: one per line, "Name, email" (email optional).
  const parents = String(formData.get("parents") || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, email] = line.split(",").map((s) => s.trim());
      return { name: name || "Parent", email: email || "" };
    });

  const { error } = await supabase.rpc("commit_payment_plan", {
    p_trip: tripId,
    p_mode: mode,
    p_choice: choice,
    p_num_installments: Number(formData.get("num_installments") || 1),
    p_parents: parents,
  });
  if (error) redirect(`/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  // Non-card school invoice: push it to Xero if configured (else the internal
  // invoice page + our own reminders remain the system of record).
  if (mode === "school_invoice") {
    await pushSchoolInvoiceToXero(supabase, tripId, trip.host_profile_id ?? null);
  }

  await logEvent(
    mode === "school_invoice" ? "invoice_issued" : "parent_links_generated",
    { profile_id: trip.host_profile_id, meta: { trip_id: tripId, choice } }
  );
  await notifyGsa(
    `Payment plan committed — ${trip.organiser_school_name ?? "a school"}`,
    `<p><strong>${trip.organiser_school_name ?? "A school"}</strong> committed to ${
      choice === "upfront" ? "paying upfront (10% discount)" : "a payment plan (+10%)"
    } via ${mode === "school_invoice" ? "a school invoice" : "individual parent payment links"}.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/trips">Open trips</a></p>`
  );
  redirect(`/trips/${tripId}?committed=1`);
}

// Pay a school-invoice instalment by card (test mode).
export async function payInstallment(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const installmentId = String(formData.get("installment_id"));
  const { supabase, trip } = await ownTrip(tripId);

  const { data: installment } = await supabase
    .from("installments")
    .select("id, amount_pennies, seq, status, payment_plans!inner(trip_id)")
    .eq("id", installmentId)
    .single();
  const plan = installment
    ? Array.isArray(installment.payment_plans)
      ? installment.payment_plans[0]
      : installment.payment_plans
    : null;
  if (!installment || plan?.trip_id !== tripId || installment.status === "paid")
    redirect(`/trips/${tripId}`);

  const origin = await siteOrigin();
  const url = await createCheckoutSession({
    amountPennies: installment.amount_pennies,
    name: `Trip payment ${installment.seq} — ${trip.organiser_school_name ?? "school trip"}`,
    successUrl: `${origin}/trips/${tripId}?payment=processing`,
    cancelUrl: `${origin}/trips/${tripId}`,
    metadata: { kind: "installment", id: installmentId },
  });
  if (url) redirect(url);
  redirect(`/trips/${tripId}?deposit=manual`);
}

// ── Steps 11–14: bolt-on quotes and supplier settlements ────────────────────
export async function requestQuotes(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase, trip } = await ownTrip(tripId);

  const { data: count, error } = await supabase.rpc("request_bolt_on_quotes", {
    p_trip: tripId,
  });
  if (error) redirect(`/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("bolt_on_quotes_requested", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId, items: count },
  });
  await notifyGsa(
    `Firm quotes requested — ${trip.organiser_school_name ?? "a school"}`,
    `<p><strong>${trip.organiser_school_name ?? "A school"}</strong> wants firm quotes for ${count} bolt-on item${count === 1 ? "" : "s"}. Confirm them with the suppliers' real prices.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/trips/${tripId}">Open the trip</a></p>`
  );
  redirect(`/trips/${tripId}?quotes=requested`);
}

export async function acceptQuote(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const itemId = String(formData.get("item_id"));
  const route = String(formData.get("route"));
  const { supabase, trip } = await ownTrip(tripId);
  if (!["pay_direct", "passthrough"].includes(route)) redirect(`/trips/${tripId}`);

  const { error } = await supabase.rpc("accept_bolt_on_quote", {
    p_item: itemId,
    p_route: route,
  });
  if (error) redirect(`/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("bolt_on_quote_accepted", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId, item_id: itemId, route },
  });
  redirect(`/trips/${tripId}?quotes=accepted`);
}

// Test-mode card payment for a passthrough settlement. The funds route to
// the supplier same-day (Stripe Connect destination-charge pattern — live
// transfers BLOCKED pending travel-law sign-off; see lib/stripe.ts).
export async function paySettlement(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const settlementId = String(formData.get("settlement_id"));
  const { supabase, trip } = await ownTrip(tripId);

  const { data: settlement } = await supabase
    .from("supplier_settlements")
    .select("id, amount_pennies, status, route, suppliers(name)")
    .eq("id", settlementId)
    .eq("trip_id", tripId)
    .single();
  if (!settlement || settlement.status !== "pending" || settlement.route !== "passthrough")
    redirect(`/trips/${tripId}`);
  const supplier = Array.isArray(settlement.suppliers)
    ? settlement.suppliers[0]
    : settlement.suppliers;

  const origin = await siteOrigin();
  const url = await createCheckoutSession({
    amountPennies: settlement.amount_pennies,
    name: `${supplier?.name ?? "Supplier"} — ${trip.organiser_school_name ?? "school trip"} (via GSA, settled same day)`,
    successUrl: `${origin}/trips/${tripId}?payment=processing`,
    cancelUrl: `${origin}/trips/${tripId}`,
    metadata: { kind: "settlement", id: settlementId },
  });
  if (url) redirect(url);
  redirect(`/trips/${tripId}?deposit=manual`);
}

// ── Step 17: booking alterations ────────────────────────────────────────────
export async function requestAlteration(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase, user, trip } = await ownTrip(tripId);

  const description = String(formData.get("description") || "").trim();
  if (!description) redirect(`/trips/${tripId}`);

  const { error } = await supabase.from("trip_alterations").insert({
    trip_id: tripId,
    requested_by: user.id,
    description,
  });
  if (error) redirect(`/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("alteration_requested", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId },
  });
  await notifyGsa(
    `Booking alteration requested — ${trip.organiser_school_name ?? "a school"}`,
    `<p><strong>${trip.organiser_school_name ?? "A school"}</strong> has requested a change to a booked trip:</p>
     <blockquote>${description}</blockquote>
     <p><a href="https://gsa-host-directory.vercel.app/admin/trips/${tripId}">Review and price the change</a></p>`
  );
  redirect(`/trips/${tripId}?alteration=requested`);
}

// ── Step 16: name lists for the final travel pack ───────────────────────────
export async function uploadNameList(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase, user } = await ownTrip(tripId);

  const file = formData.get("document") as File | null;
  if (!file || file.size === 0)
    redirect(`/trips/${tripId}?error=${encodeURIComponent("Choose a file")}`);
  if (file.size > 10 * 1024 * 1024)
    redirect(`/trips/${tripId}?error=${encodeURIComponent("Max 10MB")}`);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${tripId}/name_list/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("trip-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError)
    redirect(`/trips/${tripId}?error=${encodeURIComponent(uploadError.message)}`);

  const { error } = await supabase.from("trip_documents").insert({
    trip_id: tripId,
    kind: "name_list",
    name: file.name,
    path,
    uploaded_by: user.id,
  });
  if (error) redirect(`/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("name_list_uploaded", { meta: { trip_id: tripId } });
  await notifyGsa(
    `Name list uploaded`,
    `<p>A name list has been uploaded for a trip — ready for flight bookings and the final travel pack.</p>
     <p><a href="https://gsa-host-directory.vercel.app/admin/trips/${tripId}">Open the trip</a></p>`
  );
  redirect(`/trips/${tripId}?saved=namelist`);
}

export async function deleteDraftTrip(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase } = await ownTrip(tripId);
  await supabase.from("trips").delete().eq("id", tripId).eq("status", "draft");
  redirect("/trips");
}
