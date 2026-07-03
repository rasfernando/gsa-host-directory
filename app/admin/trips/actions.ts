"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { sendEmail, escapeHtml } from "@/lib/notify";
import { formatPounds } from "@/lib/money";
import { formatDate } from "@/lib/trips";
import { awardCredits } from "@/lib/credits";

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

async function tripWithOrganiser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string
) {
  const { data: trip } = await supabase
    .from("trips")
    .select("*, host_profiles(name)")
    .eq("id", tripId)
    .single();
  if (!trip) throw new Error("Trip not found");
  const { data: organiser } = await supabase
    .from("user_profiles")
    .select("email, full_name")
    .eq("id", trip.organiser_id)
    .single();
  return { trip, organiser };
}

// ── Mark-paid actions (the no-Stripe demo path) ─────────────────────────────
export async function adminMarkDepositPaid(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));

  const { error } = await supabase.rpc("mark_deposit_paid", {
    p_trip: tripId,
    p_ref: String(formData.get("ref") || "") || null,
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  const { trip, organiser } = await tripWithOrganiser(supabase, tripId);
  await logEvent("deposit_paid", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId },
  });
  // Booking credits go to the visiting school once its deposit lands.
  const { data: organiserProfile } = await supabase
    .from("user_profiles")
    .select("school_id")
    .eq("id", trip.organiser_id)
    .single();
  if (organiserProfile?.school_id) {
    await awardCredits(supabase, organiserProfile.school_id, "booking", tripId);
  }
  // Receipt to the organiser
  await sendEmail(
    organiser?.email,
    `Deposit received — your trip is confirmed as reserved`,
    `<p>We've received your ${formatPounds(trip.deposit_amount_pennies)} refundable deposit. Your ${trip.places_held ?? ""} places are held.</p>
     <p>You now have 30 days (until ${formatDate(trip.cancellation_deadline)}) to commit your payment plan and make the first, non-refundable payment.</p>
     <p><a href="https://gsa-host-directory.vercel.app/trips/${tripId}">Open your trip</a></p>`
  );
  redirect(`/admin/trips/${tripId}?saved=deposit`);
}

export async function adminMarkInstallmentPaid(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const installmentId = String(formData.get("installment_id"));

  const { error } = await supabase.rpc("mark_installment_paid", {
    p_installment: installmentId,
    p_ref: String(formData.get("ref") || "") || null,
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  const { trip, organiser } = await tripWithOrganiser(supabase, tripId);
  const { data: ins } = await supabase
    .from("installments")
    .select("seq, amount_pennies")
    .eq("id", installmentId)
    .single();
  await logEvent("payment_received", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId, installment_id: installmentId },
  });
  await sendEmail(
    organiser?.email,
    `Payment received — ${ins ? formatPounds(ins.amount_pennies) : "trip payment"}`,
    `<p>Thanks — we've received payment ${ins?.seq ?? ""} of your trip plan${
      ins ? ` (${formatPounds(ins.amount_pennies)})` : ""
    }.</p>
     <p><a href="https://gsa-host-directory.vercel.app/trips/${tripId}">See your remaining schedule</a></p>`
  );
  redirect(`/admin/trips/${tripId}?saved=payment`);
}

export async function adminMarkParentPaymentPaid(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const paymentId = String(formData.get("payment_id"));

  const { error } = await supabase.rpc("mark_parent_payment_paid", {
    p_payment: paymentId,
    p_ref: String(formData.get("ref") || "") || null,
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  const { trip } = await tripWithOrganiser(supabase, tripId);
  const { data: payment } = await supabase
    .from("parent_payments")
    .select("parent_name, parent_email, amount_pennies, token")
    .eq("id", paymentId)
    .single();
  await logEvent("payment_received", {
    profile_id: trip.host_profile_id,
    meta: { trip_id: tripId, parent_payment_id: paymentId },
  });
  if (payment?.parent_email) {
    await sendEmail(
      payment.parent_email,
      `Payment received — ${escapeHtml(trip.organiser_school_name ?? "school")} trip`,
      `<p>Thanks ${escapeHtml(payment.parent_name)} — we've received your payment of ${formatPounds(payment.amount_pennies)}.</p>
       <p>Your receipt: <a href="https://gsa-host-directory.vercel.app/pay/${payment.token}">view it any time</a>.</p>`
    );
  }
  redirect(`/admin/trips/${tripId}?saved=payment`);
}

// ── Reminders ────────────────────────────────────────────────────────────────
export async function sendInstallmentReminder(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const installmentId = String(formData.get("installment_id"));

  const { trip, organiser } = await tripWithOrganiser(supabase, tripId);
  const { data: ins } = await supabase
    .from("installments")
    .select("seq, amount_pennies, due_date")
    .eq("id", installmentId)
    .single();
  if (ins) {
    await sendEmail(
      organiser?.email,
      `Payment reminder — ${formatPounds(ins.amount_pennies)} due ${formatDate(ins.due_date)}`,
      `<p>A friendly reminder that payment ${ins.seq} of your trip plan (${formatPounds(ins.amount_pennies)}) is due by ${formatDate(ins.due_date)}.</p>
       <p><a href="https://gsa-host-directory.vercel.app/trips/${tripId}">Pay or review your plan</a></p>`
    );
    await supabase
      .from("installments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", installmentId);
    await logEvent("reminder_sent", { meta: { trip_id: tripId, installment_id: installmentId } });
  }
  redirect(`/admin/trips/${tripId}?saved=reminder`);
}

export async function sendParentReminder(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const paymentId = String(formData.get("payment_id"));

  const { trip } = await tripWithOrganiser(supabase, tripId);
  const { data: payment } = await supabase
    .from("parent_payments")
    .select("parent_name, parent_email, amount_pennies, token")
    .eq("id", paymentId)
    .single();
  if (payment?.parent_email) {
    await sendEmail(
      payment.parent_email,
      `Payment reminder — ${escapeHtml(trip.organiser_school_name ?? "school")} trip`,
      `<p>Hello ${escapeHtml(payment.parent_name)}, a reminder that your trip payment of ${formatPounds(payment.amount_pennies)} is still outstanding.</p>
       <p><a href="https://gsa-host-directory.vercel.app/pay/${payment.token}">Pay securely here</a></p>`
    );
    await supabase
      .from("parent_payments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", paymentId);
    await logEvent("reminder_sent", { meta: { trip_id: tripId, parent_payment_id: paymentId } });
  }
  redirect(`/admin/trips/${tripId}?saved=reminder`);
}

// ── Bolt-on quotes & supplier settlements ───────────────────────────────────
export async function confirmQuote(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const itemId = String(formData.get("item_id"));
  const pounds = String(formData.get("unit_price_pounds") || "").trim();

  const { error } = await supabase.rpc("confirm_bolt_on_quote", {
    p_item: itemId,
    p_unit_price_pennies: pounds ? Math.round(Number(pounds) * 100) : null,
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  const { trip, organiser } = await tripWithOrganiser(supabase, tripId);
  await logEvent("bolt_on_quote_confirmed", { meta: { trip_id: tripId, item_id: itemId } });
  await sendEmail(
    organiser?.email,
    "Your firm quote is ready",
    `<p>The GSA team has confirmed a firm supplier quote on your trip. Review and accept it — you'll choose whether to pay the supplier directly or via GSA (passed through the same day).</p>
     <p><a href="https://gsa-host-directory.vercel.app/trips/${tripId}">Review your quote</a></p>`
  );
  void trip;
  redirect(`/admin/trips/${tripId}?saved=quote`);
}

export async function adminMarkSettlement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const settlementId = String(formData.get("settlement_id"));
  const status = String(formData.get("status"));

  const { error } = await supabase.rpc("mark_settlement", {
    p_settlement: settlementId,
    p_status: status,
    p_ref: String(formData.get("ref") || "") || null,
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("settlement_updated", { meta: { trip_id: tripId, settlement_id: settlementId, status } });
  redirect(`/admin/trips/${tripId}?saved=settlement`);
}

// ── Invoices ────────────────────────────────────────────────────────────────
export async function setInvoiceStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const invoiceId = String(formData.get("invoice_id"));
  const status = String(formData.get("status"));
  if (!["issued", "paid", "void"].includes(status)) redirect(`/admin/trips/${tripId}`);

  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId);
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/trips/${tripId}?saved=invoice`);
}

// ── Custom basket lines (admin only; price set by GSA) ──────────────────────
export async function addCustomLine(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));

  const pounds = Number(formData.get("unit_price_pounds") || 0);
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("name", "GSA")
    .limit(1)
    .single();

  const { error } = await supabase.from("trip_items").insert({
    trip_id: tripId,
    supplier_id: String(formData.get("supplier_id") || "") || supplier?.id || null,
    label: String(formData.get("label") || "Custom item"),
    category: String(formData.get("category") || "other"),
    unit_price_pennies: Math.round(pounds * 100),
    quantity: Number(formData.get("quantity") || 1),
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/trips/${tripId}?saved=line`);
}

// ── Alterations (step 17) ───────────────────────────────────────────────────
export async function decideAlteration(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const alterationId = String(formData.get("alteration_id"));
  const decision = String(formData.get("decision")); // approve | reject

  if (decision === "reject") {
    const { error } = await supabase
      .from("trip_alterations")
      .update({
        status: "rejected",
        admin_notes: String(formData.get("admin_notes") || "") || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", alterationId);
    if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);
    redirect(`/admin/trips/${tripId}?saved=alteration`);
  }

  // Approve: set the price delta, then apply it through the DB function so
  // the ±10% rule and invoice/parent-link adjustments stay in one place.
  const pounds = Number(formData.get("price_delta_pounds") || 0);
  const { error: updateError } = await supabase
    .from("trip_alterations")
    .update({
      status: "approved",
      price_delta_pennies: Math.round(pounds * 100),
      admin_notes: String(formData.get("admin_notes") || "") || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", alterationId);
  if (updateError)
    redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(updateError.message)}`);

  const { error } = await supabase.rpc("apply_alteration", {
    p_alteration: alterationId,
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("alteration_applied", { meta: { trip_id: tripId, alteration_id: alterationId } });
  redirect(`/admin/trips/${tripId}?saved=alteration`);
}

// ── Trip documents: pre-departure packs, travel packs ───────────────────────
export async function uploadTripDocument(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const kind = String(formData.get("kind"));
  const file = formData.get("document") as File | null;
  if (!file || file.size === 0)
    redirect(`/admin/trips/${tripId}?error=${encodeURIComponent("Choose a file")}`);
  if (file.size > 10 * 1024 * 1024)
    redirect(`/admin/trips/${tripId}?error=${encodeURIComponent("Max 10MB")}`);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${tripId}/${kind}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("trip-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError)
    redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(uploadError.message)}`);

  const { error } = await supabase.from("trip_documents").insert({
    trip_id: tripId,
    kind,
    name: file.name,
    path,
    uploaded_by: user.id,
  });
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);

  await logEvent("trip_document_uploaded", { meta: { trip_id: tripId, kind } });
  redirect(`/admin/trips/${tripId}?saved=doc`);
}

export async function deleteTripDocument(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  const docId = String(formData.get("doc_id"));

  const { data: doc } = await supabase
    .from("trip_documents")
    .select("path")
    .eq("id", docId)
    .single();
  if (doc?.path) await supabase.storage.from("trip-docs").remove([doc.path]);
  await supabase.from("trip_documents").delete().eq("id", docId);
  redirect(`/admin/trips/${tripId}?saved=doc`);
}

// ── Trip lifecycle odds and ends ────────────────────────────────────────────
export async function adminCompleteTrip(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tripId = String(formData.get("trip_id"));
  // Admins pass the edit-rules trigger, so a direct update is fine here.
  const { error } = await supabase
    .from("trips")
    .update({ status: "completed" })
    .eq("id", tripId)
    .eq("status", "confirmed");
  if (error) redirect(`/admin/trips/${tripId}?error=${encodeURIComponent(error.message)}`);
  await logEvent("trip_completed", { meta: { trip_id: tripId } });
  redirect(`/admin/trips/${tripId}?saved=status`);
}

// ── Products & suppliers ────────────────────────────────────────────────────
export async function saveProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("product_id") || "");
  const pounds = Number(formData.get("unit_price_pounds") || 0);

  const fields = {
    supplier_id: String(formData.get("supplier_id")),
    type: String(formData.get("type")),
    name: String(formData.get("name")),
    description: String(formData.get("description") || "") || null,
    unit_price_pennies: Math.round(pounds * 100),
    pricing_unit: String(formData.get("pricing_unit") || "per_place"),
    tier: String(formData.get("tier") || "") || null,
    bolt_on: formData.get("bolt_on") === "on",
    active: formData.get("active") === "on",
    // Non-package routing: how this third-party product gets settled,
    // and GSA's commission on it (basis points, e.g. 1000 = 10%).
    commission_bps: Math.round(Number(formData.get("commission_pct") || 0) * 100),
    default_route: String(formData.get("default_route") || "pay_direct"),
  };

  const { error } = id
    ? await supabase.from("products").update(fields).eq("id", id)
    : await supabase.from("products").insert(fields);
  if (error) redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/products");
  redirect("/admin/products?saved=1");
}

export async function addSupplier(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("suppliers").insert({
    name: String(formData.get("name")),
    type: String(formData.get("type") || "other"),
    contact_email: String(formData.get("contact_email") || "") || null,
  });
  if (error) redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/products?saved=1");
}
