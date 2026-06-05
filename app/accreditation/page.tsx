import Link from "next/link";
import { VERIFICATION_CHECKS } from "@/lib/checklist";

// Explains the two tiers — a trust page for visiting teachers and a
// sales page for hosts considering the upgrade.
export default function AccreditationPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        What GSA accreditation means
      </h1>
      <p className="mt-4 text-gray-600">
        Every school in our directory is reviewed by the GSA team before it
        appears. But accreditation is a different standard — the gold standard
        for school integrations and immersions worldwide.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-5">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
            Listed host
          </span>
          <p className="mt-3 text-sm text-gray-600">
            A member of the GSA network that has registered to host and passed
            a basic review: the school is real, the contact is genuine, and the
            listing is accurate. Visits to listed hosts are facilitated by the
            GSA team.
          </p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-5">
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            GSA Accredited
          </span>
          <p className="mt-3 text-sm text-gray-600">
            A school that has completed GSA&apos;s full verification — personally,
            by a human, never automatically. Accredited schools are actively
            promoted by GSA, deliver structured immersion programmes, and issue
            a verification statement your leadership team can use for trip
            approval.
          </p>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold">What we verify</h2>
      <ul className="mt-4 space-y-3">
        {VERIFICATION_CHECKS.map((c) => (
          <li key={c.key} className="rounded-lg border border-gray-100 p-4">
            <p className="text-sm font-medium">{c.label}</p>
            <p className="mt-0.5 text-xs text-gray-500">{c.description}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-gray-500">
        Each accredited school&apos;s profile includes a printable verification
        statement showing exactly what was checked and when.
      </p>

      <div className="mt-10 flex flex-col gap-3 rounded-xl border border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          <strong>Host school?</strong> Accreditation puts you in the actively
          promoted catalog.
        </p>
        <Link
          href="/apply"
          className="shrink-0 rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-700"
        >
          Apply for accreditation
        </Link>
      </div>
    </div>
  );
}
