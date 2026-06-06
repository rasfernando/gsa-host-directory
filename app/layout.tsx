import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "gsa_admin";
  }

  return (
    <html lang="en">
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
                Directory
              </Link>
              <Link href="/list-your-school" className="transition-colors duration-150 hover:text-stone-900">
                Become a host
              </Link>
              {isAdmin && (
                <Link href="/admin" className="transition-colors duration-150 hover:text-stone-900">
                  Admin
                </Link>
              )}
              {user && !isAdmin && (
                <Link href="/your-school" className="transition-colors duration-150 hover:text-stone-900">
                  Your school
                </Link>
              )}
              {user ? (
                <form action={signOut}>
                  <button
                    className="transition-colors duration-150 hover:text-stone-900"
                    title={user.email}
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link href="/login" className="transition-colors duration-150 hover:text-stone-900">
                  Sign in
                </Link>
              )}
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
                Privacy
              </Link>
              <Link href="/terms" className="underline transition-colors duration-150 hover:text-stone-900">
                Terms
              </Link>
              <a
                href="mailto:hello@globalschoolalliance.com"
                className="underline transition-colors duration-150 hover:text-stone-900"
              >
                Contact
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
