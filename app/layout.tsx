import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GSA Host Schools",
  description: "Global School Alliance — verified host school directory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <header className="border-b border-gray-100">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              GSA <span className="text-gray-400">Host Schools</span>
            </Link>
            <nav className="flex gap-6 text-sm text-gray-500">
              <Link href="/apply" className="hover:text-gray-900">
                Become a host
              </Link>
              <Link href="/admin" className="hover:text-gray-900">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
