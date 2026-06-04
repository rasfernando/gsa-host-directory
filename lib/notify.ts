// Sends an email notification to the GSA team via Resend.
// Gracefully does nothing if RESEND_API_KEY isn't configured —
// submissions must never fail because email is down or unconfigured.
export async function notifyGsa(subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;

  if (!apiKey || !to) {
    console.log(`[notify skipped — RESEND_API_KEY/NOTIFY_EMAIL not set] ${subject}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM ?? "GSA Platform <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[notify failed] ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[notify failed]", err);
  }
}
