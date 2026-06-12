import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, notifyGsa } from "@/lib/notify";

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

  return Response.json({
    cancelled: rows.filter((r) => r.kind === "cancelled").length,
    reminded: rows.filter((r) => r.kind === "reminder").length,
  });
}
