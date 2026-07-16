"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Client form; copy is passed in from the server page (this app translates
// server-side via getTranslations — there is no NextIntlClientProvider, so
// client components receive already-translated strings as props).
export type LoginLabels = {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  signIn: string;
  createAccount: string;
  working: string;
  needAccount: string;
  haveAccount: string;
  forgot: string;
};

export function LoginForm({ next, labels }: { next: string; labels: LoginLabels }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError("");
    const supabase = createClient();
    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    // Full navigation so the server picks up the new auth cookies.
    window.location.href = next;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {labels.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          placeholder={labels.emailPlaceholder}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          {labels.passwordLabel}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "working"}
        className="w-full rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700 disabled:opacity-50"
      >
        {status === "working"
          ? labels.working
          : mode === "signup"
            ? labels.createAccount
            : labels.signIn}
      </button>

      <div className="flex items-center justify-between pt-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
          }}
          className="font-medium text-warm-700 hover:text-warm-600"
        >
          {mode === "signin" ? labels.needAccount : labels.haveAccount}
        </button>
        {mode === "signin" && (
          <Link href="/reset" className="text-stone-500 hover:text-stone-900">
            {labels.forgot}
          </Link>
        )}
      </div>
    </form>
  );
}
