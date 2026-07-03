"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Client form; all copy is passed in from the server page (this app translates
// server-side via getTranslations — there is no NextIntlClientProvider, so
// client components receive already-translated strings as props).
export type LoginLabels = {
  emailLabel: string;
  emailPlaceholder: string;
  sending: string;
  submit: string;
  // "…sent a link to {{EMAIL}}." — the page interpolates the sentinel.
  sentToTemplate: string;
};

export function LoginForm({ next, labels }: { next: string; labels: LoginLabels }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-stone-600">
        {labels.sentToTemplate.replace("{{EMAIL}}", email)}
      </p>
    );
  }

  return (
    <form onSubmit={sendMagicLink} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {labels.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          placeholder={labels.emailPlaceholder}
        />
      </div>
      {status === "error" && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700 disabled:opacity-50"
      >
        {status === "sending" ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
