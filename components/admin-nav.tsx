"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Module } from "@/lib/features";

// Tabs with no module are the host-registration journey and always show.
// The rest appear only when their module is switched on (lib/features.ts).
const TABS: { href: string; label: string; module?: Module }[] = [
  { href: "/admin", label: "Review queue" },
  { href: "/admin/profiles", label: "Profiles" },
  { href: "/admin/supply", label: "Onboarding" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/enquiries", label: "Enquiries", module: "enquiries" },
  { href: "/admin/suppliers", label: "Suppliers", module: "suppliers" },
  { href: "/admin/trips", label: "Trips", module: "trips" },
  { href: "/admin/products", label: "Products", module: "products" },
  { href: "/admin/credits", label: "Credits", module: "credits" },
  { href: "/admin/erasmus", label: "Erasmus+", module: "erasmus" },
  { href: "/admin/metrics", label: "Metrics", module: "metrics" },
];

export function AdminNav({ enabled }: { enabled: Module[] }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => !tab.module || enabled.includes(tab.module));
  return (
    <nav className="mb-8 flex gap-1 border-b border-gray-100 pb-0 text-sm">
      {tabs.map((tab) => {
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
