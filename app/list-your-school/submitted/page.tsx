
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
        Thank you for joining the GSA hosting network. The GSA team reviews
        every new registration — usually within a couple of days — and
        we&apos;ll be in touch once yours has been looked at.
      </p>
      {/* Accreditation upsell removed for V1 at Heather's request (29 Oct 2026). */}
    </div>
  );
}
