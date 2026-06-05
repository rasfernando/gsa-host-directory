import Link from "next/link";

export default function SubmittedPage() {
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
        Application received
      </h1>
      <p className="mt-3 leading-relaxed text-stone-500">
        Thank you — the GSA team reviews every application personally. We&apos;ll
        contact you to arrange verification, including a video call with your
        leadership team.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm text-stone-500 underline transition-colors duration-150 hover:text-stone-900"
      >
        Back to home
      </Link>
    </div>
  );
}
