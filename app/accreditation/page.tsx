import Link from "next/link";
import { VERIFICATION_CHECKS } from "@/lib/checklist";

// Explains the two tiers — a trust page for visiting teachers and a
// sales page for hosts considering the upgrade.
export default function AccreditationPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
        Trust &amp; verification
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        What GSA accreditation means
      </h1>
      <p className="mt-4 leading-relaxed text-stone-600">
        Every school in our directory is reviewed by the GSA team before it
        appears. But accreditation is a different standard — the gold standard
        for school integrations and immersions worldwide.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm">
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
            Listed host
          </span>
          <p className="mt-4 text-sm leading-relaxed text-stone-600">
            A member of the GSA network that has registered to host and passed
            a basic review: the school is real, the contact is genuine, and the
            listing is accurate. Visits to listed hosts are facilitated by the
            GSA team.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-6 shadow-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckIcon className="h-3.5 w-3.5" />
            GSA Accredited
          </span>
          <p className="mt-4 text-sm leading-relaxed text-stone-600">
            A school that has completed GSA&apos;s full verification — personally,
            by a human, never automatically. Accredited schools are actively
            promoted by GSA, deliver structured immersion programmes, and issue
            a verification statement your leadership team can use for trip
            approval.
          </p>
        </div>
      </div>

      <h2 className="mt-12 text-xl font-bold tracking-tight">What we verify</h2>
      <ul className="mt-5 space-y-3">
        {VERIFICATION_CHECKS.map((c) => (
          <li
            key={c.key}
            className="flex gap-3.5 rounded-xl border border-stone-200/70 bg-white p-4 shadow-sm"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                {c.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-stone-500">
        Each accredited school&apos;s profile includes a printable verification
        statement showing exactly what was checked and when.
      </p>

      <div className="mt-12 flex flex-col gap-4 rounded-2xl bg-brand-800 p-7 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-brand-100">
          <strong className="text-white">Host school?</strong> Accreditation
          puts you in the actively promoted catalog.
        </p>
        <Link
          href="/apply"
          className="shrink-0 rounded-lg bg-white px-5 py-2.5 text-center text-sm font-semibold text-brand-800 transition-colors duration-150 hover:bg-brand-50"
        >
          Apply for accreditation
        </Link>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
