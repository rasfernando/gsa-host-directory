"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type ResetRequestLabels = {
  emailLabel: string;
  send: string;
  working: string;
  sent: string;
  backToLogin: string;
};

export function ResetRequestForm({ labels }: { labels: ResetRequestLabels }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "sent">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    const supabase = createClient();
    // The link lands on /auth/confirm (exchanges the code) → /reset/update.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset/update`,
    });
    // Always report success — never reveal whether an address is registered.
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {labels.sent}
        </p>
        <Link href="/login" className="text-sm text-stone-500 hover:text-stone-900">
          {labels.backToLogin}
        </Link>
      </div>
    );
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
        />
      </div>
      <button
        type="submit"
        disabled={status === "working"}
        className="w-full rounded-lg bg-warm-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700 disabled:opacity-50"
      >
        {status === "working" ? labels.working : labels.send}
      </button>
      <Link href="/login" className="block text-sm text-stone-500 hover:text-stone-900">
        {labels.backToLogin}
      </Link>
    </form>
  );
}

export type ResetUpdateLabels = {
  newPasswordLabel: string;
  update: string;
  working: string;
  updated: string;
  goToApp: string;
};

export function ResetUpdateForm({ labels }: { labels: ResetUpdateLabels }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {labels.updated}
        </p>
        <Link
          href="/your-school"
          className="inline-block rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-warm-700"
        >
          {labels.goToApp}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          {labels.newPasswordLabel}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
        {status === "working" ? labels.working : labels.update}
      </button>
    </form>
  );
}
