import Link from "next/link";

export default function ListingSubmittedPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg
          className="h-6 w-6"
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
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight">
        Listing received
      </h1>
      <p className="mt-3 leading-relaxed text-stone-500">
        The GSA team gives every new listing a quick review before it goes
        live — usually within a couple of days. We&apos;ll email you when
        you&apos;re in the directory.
      </p>
      <p className="mx-auto mt-8 max-w-md rounded-xl border border-stone-200/70 bg-white p-5 text-sm leading-relaxed text-stone-600 shadow-sm">
        Want more? <strong>GSA Accredited</strong> schools are actively
        promoted to visiting groups worldwide and carry the gold-standard
        verification badge.{" "}
        <Link href="/apply" className="font-semibold text-brand-700 underline">
          Apply for accreditation →
        </Link>
      </p>
    </div>
  );
}
