"use client";

import { useState } from "react";

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";
const labelCls = "block text-sm font-medium text-stone-700";

export type ChangePasswordLabels = {
  newPassword: string;
  confirmPassword: string;
  update: string;
  mismatch: string;
};

export function ChangePasswordForm({
  action,
  labels,
}: {
  action: (formData: FormData) => void | Promise<void>;
  labels: ChangePasswordLabels;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && pw !== confirm;
  const tooShort = pw.length > 0 && pw.length < 8;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (pw !== confirm || pw.length < 8) e.preventDefault();
      }}
      className="mt-4 space-y-4"
    >
      <div>
        <label className={labelCls} htmlFor="password">{labels.newPassword}</label>
        <input
          className={inputCls}
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="confirm">{labels.confirmPassword}</label>
        <input
          className={inputCls}
          id="confirm"
          name="confirm"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {mismatch && <p className="text-sm text-red-600">{labels.mismatch}</p>}
      <button
        disabled={mismatch || tooShort || pw.length === 0}
        className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700 disabled:opacity-50"
      >
        {labels.update}
      </button>
    </form>
  );
}
