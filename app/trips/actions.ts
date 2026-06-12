"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyGsa } from "@/lib/notify";
import { logEvent } from "@/lib/events";

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

export async function deleteDraftTrip(formData: FormData) {
  const tripId = String(formData.get("trip_id"));
  const { supabase } = await ownTrip(tripId);
  await supabase.from("trips").delete().eq("id", tripId).eq("status", "draft");
  redirect("/trips");
}
