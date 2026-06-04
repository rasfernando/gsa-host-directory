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

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <header className="border-b border-gray-100">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              GSA <span className="text-gray-400">Host Schools</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/directory" className="hover:text-gray-900">
                Directory
              </Link>
              <Link href="/apply" className="hover:text-gray-900">
                Become a host
              </Link>
              {user ? (
                <form action={signOut}>
                  <button className="hover:text-gray-900" title={user.email}>
                    Sign out
                  </button>
                </form>
              ) : (
                <Link href="/login" className="hover:text-gray-900">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
