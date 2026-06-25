import Link from "next/link";

export const dynamic = "force-dynamic";

// Shown to the public while the platform is in onboarding (soft-launch) mode.
export default function ComingSoonPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
        Global School Alliance
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        Something special is on its way
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-stone-600">
        We&apos;re onboarding our founding host schools and partners ahead of a
        wider launch. The full directory and trip-planning tools open to
        everyone soon.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/accreditation"
          className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          How accreditation works
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors duration-150 hover:border-stone-400"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-6 text-xs text-stone-500">
        A host school we&apos;ve invited?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        to complete your profile, or use the private link in your invitation
        email.
      </p>
    </div>
  );
}
