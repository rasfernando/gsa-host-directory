"use client";

import { useState } from "react";
import {
  AGE_BANDS,
  CONTACT_ROLES,
  LANGUAGE_SUGGESTIONS,
  MONTHS,
  SUBJECT_SUGGESTIONS,
  inputCls,
  labelCls,
} from "@/lib/forms";

// Interactive host-profile fields shared by the public listing form and the
// GSA intake templates. Plain inputs submit via the surrounding server-action
// form; only the live affordances (counter, pre-fill, chips) need client JS.

type Defaults = {
  role?: string;
  why_host?: string;
  age_band?: string;
  age_range_min?: number | null;
  age_range_max?: number | null;
  subject_strengths?: string[];
  hosted_before?: boolean | null;
  host_months?: string[];
};

const WHY_HOST_LIMIT = 150;

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function RoleField({ defaultValue }: { defaultValue?: string }) {
  const known = CONTACT_ROLES.includes(defaultValue ?? "");
  const [role, setRole] = useState(known ? (defaultValue ?? "") : defaultValue ? "Other" : "");
  return (
    <div>
      <label className={labelCls} htmlFor="contact_role">Your role</label>
      <select
        className={inputCls}
        id="contact_role"
        name="contact_role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="">Select your role…</option>
        {CONTACT_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {role === "Other" && (
        <input
          className={`${inputCls} mt-2`}
          name="contact_role_other"
          placeholder="Tell us your role"
          defaultValue={known ? "" : (defaultValue ?? "")}
        />
      )}
    </div>
  );
}

export function WhyHostField({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const words = wordCount(value);
  const over = words > WHY_HOST_LIMIT;
  return (
    <div>
      <label className={labelCls} htmlFor="why_host">
        Why would you like to host?{" "}
        <span className="font-normal text-stone-500">(up to {WHY_HOST_LIMIT} words)</span>
      </label>
      <textarea
        className={inputCls}
        id="why_host"
        name="why_host"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What does your school hope to get from welcoming visiting groups?"
      />
      <p className={`mt-1 text-xs ${over ? "font-semibold text-warm-700" : "text-stone-500"}`}>
        {words}/{WHY_HOST_LIMIT} words{over ? " — please trim a little" : ""}
      </p>
    </div>
  );
}

export function CountedTextarea({
  name,
  label,
  limit,
  rows = 5,
  defaultValue = "",
  placeholder,
  required,
}: {
  name: string;
  label: string;
  limit: number;
  rows?: number;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const words = wordCount(value);
  const over = words > limit;
  return (
    <div>
      <label className={labelCls} htmlFor={name}>
        {label}{" "}
        <span className="font-normal text-stone-500">(up to {limit} words)</span>
      </label>
      <textarea
        className={inputCls}
        id={name}
        name={name}
        rows={rows}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <p className={`mt-1 text-xs ${over ? "font-semibold text-warm-700" : "text-stone-500"}`}>
        {words}/{limit} words{over ? " — please trim a little" : ""}
      </p>
    </div>
  );
}

export function AgeBandField({
  defaultBand = "",
  defaultMin,
  defaultMax,
}: {
  defaultBand?: string;
  defaultMin?: number | null;
  defaultMax?: number | null;
}) {
  const [min, setMin] = useState<string>(defaultMin != null ? String(defaultMin) : "");
  const [max, setMax] = useState<string>(defaultMax != null ? String(defaultMax) : "");
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="age_band">Age range</label>
        <select
          className={inputCls}
          id="age_band"
          name="age_band"
          defaultValue={defaultBand}
          onChange={(e) => {
            const band = AGE_BANDS.find((b) => b.value === e.target.value);
            if (band?.min != null) setMin(String(band.min));
            if (band?.max != null) setMax(String(band.max));
          }}
        >
          <option value="">Select an age range…</option>
          {AGE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-500">
          Picking a band fills the exact ages below — adjust them if yours differ.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="age_range_min">Ages from</label>
          <input
            className={inputCls}
            id="age_range_min"
            name="age_range_min"
            type="number"
            min={3}
            max={19}
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="age_range_max">Ages to</label>
          <input
            className={inputCls}
            id="age_range_max"
            name="age_range_max"
            type="number"
            min={3}
            max={19}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function SubjectStrengthsField({ defaultValue = [] }: { defaultValue?: string[] }) {
  const [chosen, setChosen] = useState<string[]>(defaultValue);
  const [custom, setCustom] = useState("");
  const toggle = (s: string) =>
    setChosen((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));
  const addCustom = () => {
    const v = custom.trim();
    if (v && !chosen.includes(v)) setChosen((c) => [...c, v]);
    setCustom("");
  };
  return (
    <div>
      <label className={labelCls}>Subject strengths</label>
      <p className="mt-0.5 text-xs text-stone-500">Pick any that apply, or add your own.</p>
      {chosen.map((s) => (
        <input key={s} type="hidden" name="subject_strengths" value={s} />
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        {[...new Set([...SUBJECT_SUGGESTIONS, ...chosen])].map((s) => {
          const on = chosen.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={
                on
                  ? "rounded-full bg-warm-600 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:border-stone-400"
              }
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={inputCls}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add another subject"
        />
        <button
          type="button"
          onClick={addCustom}
          className="shrink-0 rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:border-stone-400"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Multi-select with quick-picks + free additions (cuts spelling errors).
export function LanguagesField({ defaultValue = [] }: { defaultValue?: string[] }) {
  const [chosen, setChosen] = useState<string[]>(defaultValue);
  const [custom, setCustom] = useState("");
  const toggle = (s: string) =>
    setChosen((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));
  const addCustom = () => {
    const v = custom.trim();
    if (v && !chosen.includes(v)) setChosen((c) => [...c, v]);
    setCustom("");
  };
  return (
    <div>
      <label className={labelCls}>Languages spoken</label>
      <p className="mt-0.5 text-xs text-stone-500">Pick any that apply, or add your own.</p>
      {chosen.map((s) => (
        <input key={s} type="hidden" name="languages" value={s} />
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        {[...new Set([...LANGUAGE_SUGGESTIONS, ...chosen])].map((s) => {
          const on = chosen.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={
                on
                  ? "rounded-full bg-warm-600 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:border-stone-400"
              }
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={inputCls}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add another language"
        />
        <button
          type="button"
          onClick={addCustom}
          className="shrink-0 rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:border-stone-400"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function HostMonthsField({ defaultValue = [] }: { defaultValue?: string[] }) {
  const [chosen, setChosen] = useState<string[]>(defaultValue);
  const toggle = (m: string) =>
    setChosen((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]));
  return (
    <div>
      <label className={labelCls}>When can you typically host?</label>
      <p className="mt-0.5 text-xs text-stone-500">Select all the months that usually work.</p>
      {chosen.map((m) => (
        <input key={m} type="hidden" name="host_months" value={m} />
      ))}
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {MONTHS.map((m) => {
          const on = chosen.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              className={
                on
                  ? "rounded-lg bg-warm-600 px-2 py-1.5 text-xs font-medium text-white"
                  : "rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-400"
              }
            >
              {m.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HostedBeforeField({ defaultValue }: { defaultValue?: boolean | null }) {
  return (
    <div>
      <label className={labelCls}>Have you hosted international groups before?</label>
      <div className="mt-2 flex gap-4">
        {[
          { v: "yes", label: "Yes" },
          { v: "no", label: "No" },
        ].map((o) => (
          <label key={o.v} className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="radio"
              name="hosted_before"
              value={o.v}
              defaultChecked={defaultValue === (o.v === "yes")}
              className="accent-warm-600"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// Convenience bundle for forms that want the whole new block in order.
export function HostProfileExtraFields({ d = {} }: { d?: Defaults }) {
  return (
    <>
      <WhyHostField defaultValue={d.why_host} />
      <AgeBandField defaultBand={d.age_band} defaultMin={d.age_range_min} defaultMax={d.age_range_max} />
      <SubjectStrengthsField defaultValue={d.subject_strengths} />
      <HostedBeforeField defaultValue={d.hosted_before} />
      <HostMonthsField defaultValue={d.host_months} />
    </>
  );
}
