"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Review queue" },
  { href: "/admin/profiles", label: "Profiles" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/trips", label: "Trips" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/metrics", label: "Metrics" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex gap-1 border-b border-gray-100 pb-0 text-sm">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/applications")
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "-mb-px border-b-2 border-gray-900 px-3 py-2 font-medium text-gray-900"
                : "-mb-px border-b-2 border-transparent px-3 py-2 font-medium text-gray-500 hover:text-gray-900"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
