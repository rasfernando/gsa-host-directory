import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

// Shown to the public while the platform is in onboarding (soft-launch) mode.
export default async function ComingSoonPage() {
  const t = await getTranslations("comingSoon");

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-warm-700">
        {t("kicker")}
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        {t("title")}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-stone-600">
        {t("body")}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/accreditation"
          className="rounded-lg bg-warm-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-warm-700"
        >
          {t("accreditationLink")}
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors duration-150 hover:border-stone-400"
        >
          {t("signIn")}
        </Link>
      </div>
      <p className="mt-6 text-xs text-stone-500">
        {t("invitedHostPrompt")}{" "}
        <Link href="/login" className="underline">
          {t("invitedHostSignIn")}
        </Link>{" "}
        {t("invitedHostSuffix")}
      </p>
    </div>
  );
}
