import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { LocaleSwitcher } from "@/components/locale-switcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "GSA Host Schools",
  description: "Global School Alliance — verified host school directory",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let isAgent = false;
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "gsa_admin";
    isAgent = profile?.role === "agent";
  }

  return (
    <html lang={locale}>
      <body className="min-h-screen overflow-x-clip bg-stone-50 text-stone-900 antialiased">
        <header className="border-b border-stone-200/70 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-[13px] font-bold text-white"
              >
                G
              </span>
              <span className="text-sm font-semibold tracking-tight">
                GSA <span className="font-normal text-stone-500">Host Schools</span>
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-stone-600">
              <Link href="/directory" className="transition-colors duration-150 hover:text-stone-900">
                {t("directory")}
              </Link>
              <Link href="/list-your-school" className="transition-colors duration-150 hover:text-stone-900">
                {t("becomeHost")}
              </Link>
              {user && (
                <Link href="/trips" className="transition-colors duration-150 hover:text-stone-900">
                  {t("myTrips")}
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className="transition-colors duration-150 hover:text-stone-900">
                  {t("admin")}
                </Link>
              )}
              {isAgent && (
                <Link href="/agent" className="transition-colors duration-150 hover:text-stone-900">
                  {t("agentHub")}
                </Link>
              )}
              {user && !isAdmin && !isAgent && (
                <Link href="/your-school" className="transition-colors duration-150 hover:text-stone-900">
                  {t("yourSchool")}
                </Link>
              )}
              {user ? (
                <form action={signOut}>
                  <button
                    className="transition-colors duration-150 hover:text-stone-900"
                    title={user.email}
                  >
                    {t("signOut")}
                  </button>
                </form>
              ) : (
                <Link href="/login" className="transition-colors duration-150 hover:text-stone-900">
                  {t("signIn")}
                </Link>
              )}
              <div className="border-l border-stone-200 pl-4">
                <LocaleSwitcher locale={locale} />
              </div>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mt-16 border-t border-stone-200/70 bg-white print:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} Global School Alliance ·{" "}
              <a
                href="https://www.globalschoolalliance.com"
                className="underline transition-colors duration-150 hover:text-stone-900"
              >
                globalschoolalliance.com
              </a>
            </p>
            <nav className="flex gap-4">
              <Link href="/privacy" className="underline transition-colors duration-150 hover:text-stone-900">
                {tf("privacy")}
              </Link>
              <Link href="/terms" className="underline transition-colors duration-150 hover:text-stone-900">
                {tf("terms")}
              </Link>
              <a
                href="mailto:hello@globalschoolalliance.com"
                className="underline transition-colors duration-150 hover:text-stone-900"
              >
                {tf("contact")}
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
