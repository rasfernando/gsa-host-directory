import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, notifyGsa } from "@/lib/notify";
import { contentHash, translateAndStoreProfile, translationEnabled } from "@/lib/translate";
import { getXeroInvoiceStatus, xeroEnabled } from "@/lib/xero";
import { formatPounds } from "@/lib/money";

// Daily conversion clock (Vercel cron). Expires reservations that didn't
// convert within 30 days (deposit refunded) and sends the in-window
// reminders. Env-gated like everything else: without CRON_SECRET and the
// service key this endpoint declines and the clock simply doesn't run.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("cron not configured", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return new Response("service client not configured", { status: 503 });
  }

  const { data, error } = await supabase.rpc("run_conversion_clock");
  if (error) {
    console.error("[cron] conversion clock failed:", error.message);
    return new Response("conversion clock failed", { status: 500 });
  }

  type ClockRow = {
    kind: "cancelled" | "reminder";
    trip_id: string;
    organiser_email: string | null;
    school_name: string | null;
    days_left: number;
  };
  const rows = (data ?? []) as ClockRow[];

  for (const row of rows) {
    const tripUrl = `https://gsa-host-directory.vercel.app/trips/${row.trip_id}`;
    if (row.kind === "cancelled") {
      await sendEmail(
        row.organiser_email ?? undefined,
        "Your trip reservation has been released",
        `<p>Your reservation wasn't confirmed within the 30-day window, so the held places have been released and your £1,000 deposit will be refunded.</p>
         <p>If you still want to run the trip, you can start a new reservation any time: <a href="${tripUrl}">view the trip</a>.</p>`
      );
      await notifyGsa(
        `Reservation auto-cancelled — ${row.school_name ?? "a school"}`,
        `<p>The 30-day conversion window expired. Deposit marked refunded — process the refund.</p>
         <p><a href="https://gsa-host-directory.vercel.app/admin/trips/${row.trip_id}">Open the trip</a></p>`
      );
    } else {
      await sendEmail(
        row.organiser_email ?? undefined,
        `${row.days_left} day${row.days_left === 1 ? "" : "s"} left to confirm your trip`,
        `<p>Your reserved places are held until the end of the conversion window — ${row.days_left} day${row.days_left === 1 ? "" : "s"} to go.</p>
         <p>Confirm by committing your payment plan (the first payment is the GSA service fee). Need help with your parent launch first? Book a 1-2-1 from your trip page.</p>
         <p><a href="${tripUrl}">Confirm your trip</a></p>`
      );
    }
    await supabase.from("events").insert({
      event: row.kind === "cancelled" ? "reservation_expired" : "conversion_reminder_sent",
      meta: { trip_id: row.trip_id, days_left: row.days_left },
    });
  }

  // ── Departure clock: T-90/60/30 milestones, T-29 lock, T-14/T-7 chases ──
  const { data: depData, error: depError } = await supabase.rpc("run_departure_clock");
  if (depError) {
    console.error("[cron] departure clock failed:", depError.message);
    return new Response("departure clock failed", { status: 500 });
  }
  type DepartureRow = {
    kind: "milestone" | "lock" | "final_details" | "travel_pack";
    trip_id: string;
    organiser_email: string | null;
    school_name: string | null;
    days_left: number;
    missing_doc: boolean;
  };
  const depRows = (depData ?? []) as DepartureRow[];

  for (const row of depRows) {
    const tripUrl = `https://gsa-host-directory.vercel.app/trips/${row.trip_id}`;
    if (row.kind === "milestone") {
      await sendEmail(
        row.organiser_email ?? undefined,
        `${row.days_left} days to departure`,
        `<p>${row.days_left} days until your trip. Check your payment schedule is on track and start collecting full passport names — your final name list unlocks flights and the travel pack.</p>
         <p><a href="${tripUrl}">Open your trip</a></p>`
      );
    } else if (row.kind === "lock") {
      await sendEmail(
        row.organiser_email ?? undefined,
        "Final month: your trip details are now locked",
        `<p>You're inside the final month, so no further changes can be made to the booking — this keeps suppliers, packs and paperwork in sync. Anything urgent goes through the GSA team.</p>
         <p>Now due: your final name list (full passport names).</p>
         <p><a href="${tripUrl}">Upload your name list</a></p>`
      );
    } else if (row.kind === "final_details") {
      await sendEmail(
        row.organiser_email ?? undefined,
        row.missing_doc
          ? "Action needed: your name list is overdue"
          : "Two weeks to go — passports and visas check",
        row.missing_doc
          ? `<p>Two weeks to departure and we don't yet have your final name list — flights and the travel pack are waiting on it.</p>
             <p><a href="${tripUrl}">Upload it now</a></p>`
          : `<p>Two weeks to go! Final checks: passports valid 6+ months, visas/ETAs where needed, EHIC/GHIC cards, and medication notes shared with the host school.</p>
             <p><a href="${tripUrl}">Open your pre-departure pack</a></p>`
      );
    } else if (row.kind === "travel_pack") {
      if (row.missing_doc) {
        await notifyGsa(
          `Travel pack missing — ${row.school_name ?? "a trip"} departs in ${row.days_left} days`,
          `<p>No final travel pack has been uploaded yet for this trip. Upload it so the school has tickets, transfers and emergency contacts in one place.</p>
           <p><a href="https://gsa-host-directory.vercel.app/admin/trips/${row.trip_id}">Upload the pack</a></p>`
        );
      } else {
        await sendEmail(
          row.organiser_email ?? undefined,
          "One week to go — your travel pack is ready",
          `<p>Departure is a week away. Your final travel pack is in your trip documents — print it and share it with all accompanying staff.</p>
           <p><a href="${tripUrl}/predeparture">Open the pack</a></p>`
        );
      }
    }
    await supabase.from("events").insert({
      event: `departure_${row.kind}`,
      meta: { trip_id: row.trip_id, days_left: row.days_left, missing_doc: row.missing_doc },
    });
  }

  // ── Translation sweep: catch profiles whose content changed without going
  // through a publish/approval (or where that hook failed). Capped per run.
  let translated = 0;
  if (translationEnabled()) {
    const { data: candidates } = await supabase
      .from("host_profiles")
      .select("id, headline, description, typical_hosting_windows, city, translations")
      .eq("published", true);
    const stale = (candidates ?? []).filter((p) => {
      const existing = (p.translations as Record<string, unknown> | null) ?? {};
      return existing["_hash"] !== contentHash(p);
    });
    for (const p of stale.slice(0, 5)) {
      if (await translateAndStoreProfile(supabase, p.id)) translated++;
    }
    if (stale.length > 5) {
      console.log(`[cron] translation sweep: ${stale.length - 5} profiles deferred to next run`);
    }
  }

  // ── School-invoice lane: sync Xero status + T-minus due reminders ─────────
  // Reminders escalate against the invoice due date and stop once paid.
  // Works in fallback mode too (no Xero): reminders still fire from our own
  // email infra; only the status-sync step needs Xero.
  let invoiceReminders = 0;
  const REMINDER_DAYS = [90, 60, 30, 14, 7, 1];
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, trip_id, invoice_number, amount_pennies, due_date, status, xero_invoice_id, xero_url, xero_status, invoice_reminder_stage, trips(organiser_id, organiser_school_name)")
    .eq("recipient_type", "school")
    .in("status", ["issued"]);

  for (const inv of openInvoices ?? []) {
    // Sync from Xero first (may flip status to paid).
    if (xeroEnabled() && inv.xero_invoice_id) {
      const xs = await getXeroInvoiceStatus(inv.xero_invoice_id);
      if (xs && xs !== inv.xero_status) {
        const paid = xs === "PAID";
        await supabase
          .from("invoices")
          .update({ xero_status: xs, ...(paid ? { status: "paid" } : {}) })
          .eq("id", inv.id);
        if (paid) continue; // settled — no reminder
      }
    }
    if (!inv.due_date) continue;
    const d = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86_400_000);
    const stage = REMINDER_DAYS.find((t) => d <= t) ?? null;
    if (stage == null) continue;
    const sent = inv.invoice_reminder_stage as number | null;
    if (sent != null && stage >= sent) continue; // already reminded at/earlier than this threshold

    const trip = Array.isArray(inv.trips) ? inv.trips[0] : inv.trips;
    const { data: organiser } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("id", trip?.organiser_id)
      .maybeSingle();
    const overdue = d <= 0;
    await sendEmail(
      organiser?.email,
      overdue
        ? `Overdue: invoice ${inv.invoice_number}`
        : `${d} day${d === 1 ? "" : "s"} to pay invoice ${inv.invoice_number}`,
      `<p>${overdue ? "Your school invoice is now overdue." : `Your school invoice is due in ${d} day${d === 1 ? "" : "s"}.`} Amount outstanding: ${formatPounds(inv.amount_pennies)}.</p>
       ${inv.xero_url ? `<p><a href="${inv.xero_url}">View &amp; pay the invoice</a></p>` : `<p><a href="https://gsa-host-directory.vercel.app/trips/${inv.trip_id}">View your trip &amp; invoice</a></p>`}`
    );
    await supabase.from("invoices").update({ invoice_reminder_stage: stage }).eq("id", inv.id);
    invoiceReminders++;
  }

  return Response.json({
    cancelled: rows.filter((r) => r.kind === "cancelled").length,
    reminded: rows.filter((r) => r.kind === "reminder").length,
    departure_events: depRows.length,
    translated,
    invoice_reminders: invoiceReminders,
  });
}
